const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/auth");
const upload = require("../middleware/upload");
const filesController = require("../controllers/filesController");

router.use(authenticate); // every route below requires a valid JWT

router.post("/upload", upload.single("file"), filesController.uploadFile);
router.get("/", filesController.listFiles);
router.get("/:key/view", filesController.getFileUrl);
router.get("/:key/share", filesController.shareFile);
router.delete("/:key", filesController.deleteFile);

module.exports = router;
