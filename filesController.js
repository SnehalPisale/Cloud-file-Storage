const {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const s3Client = require("../config/s3Client");

const BUCKET = process.env.S3_BUCKET_NAME;

// Every file is namespaced under the logged-in user's username so one
// user can never list, download, or delete another user's files.
// This is the "basic access permission" layer the assignment asks for.
function userPrefix(username) {
  return `${username}/`;
}

function isOwnedByUser(key, username) {
  return key.startsWith(userPrefix(username));
}

// POST /api/files/upload  (multipart/form-data, field name "file")
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided (field name must be 'file')" });
    }

    const key = `${userPrefix(req.user.username)}${Date.now()}-${req.file.originalname}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        Metadata: { uploadedby: req.user.username },
      })
    );

    res.status(201).json({
      message: "File uploaded successfully",
      key,
      name: req.file.originalname,
      size: req.file.size,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/files
exports.listFiles = async (req, res) => {
  try {
    const data = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: userPrefix(req.user.username),
      })
    );

    const files = (data.Contents || []).map((item) => ({
      key: item.Key,
      name: item.Key.split("/").slice(1).join("/"),
      size: item.Size,
      lastModified: item.LastModified,
    }));

    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/files/:key/view  -> short-lived presigned URL for viewing/downloading
exports.getFileUrl = async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);

    if (!isOwnedByUser(key, req.user.username)) {
      return res.status(403).json({ error: "You do not have access to this file" });
    }

    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 min

    res.json({ url, expiresIn: 300 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/files/:key/share?expiresIn=3600  -> shareable link (bonus feature)
exports.shareFile = async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);

    if (!isOwnedByUser(key, req.user.username)) {
      return res.status(403).json({ error: "You do not have access to this file" });
    }

    // Clamp expiry between 1 minute and 7 days (S3 presigned URL max with static creds)
    let expiresIn = parseInt(req.query.expiresIn, 10) || 3600;
    expiresIn = Math.min(Math.max(expiresIn, 60), 604800);

    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const shareUrl = await getSignedUrl(s3Client, command, { expiresIn });

    res.json({ shareUrl, expiresIn });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/files/:key
exports.deleteFile = async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);

    if (!isOwnedByUser(key, req.user.username)) {
      return res.status(403).json({ error: "You do not have access to this file" });
    }

    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    res.json({ message: "File deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
