# Vault — Cloud File Storage System

A small full-stack app that lets a logged-in user upload, view/download,
share, and delete files, with everything stored in AWS S3.

- **Backend:** Node.js + Express, AWS SDK v3
- **Frontend:** plain HTML/CSS/JS (no build step), served by the backend
- **Storage:** AWS S3 (free tier friendly)
- **Auth:** simple JWT login (single admin user) so every file is scoped
  to a user and can't be read/deleted by anyone else
- **Bonus:** shareable, time-limited download links via S3 presigned URLs

```
cloud-file-storage/
├── backend/
│   ├── src/
│   │   ├── config/s3Client.js       # AWS S3 client setup
│   │   ├── middleware/auth.js       # JWT auth guard
│   │   ├── middleware/upload.js     # multer: file type + size validation
│   │   ├── controllers/filesController.js  # upload/list/view/share/delete
│   │   ├── routes/auth.js           # POST /api/auth/login
│   │   ├── routes/files.js          # /api/files/*
│   │   └── server.js                # app entry point
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── README.md
```

---

## 1. Prerequisites

- Node.js 18+ and npm
- An AWS account (the free tier covers this comfortably — S3 free tier is
  5 GB storage + 20,000 GET / 2,000 PUT requests per month for 12 months)

---

## 2. Create an IAM user (AWS Console)

1. Go to **IAM → Users → Create user**.
2. Name it e.g. `vault-app-user`. Do **not** enable console access —
   this user only needs programmatic (API) access.
3. Skip attaching a group for now — you'll attach an inline policy scoped
   to just your bucket (least privilege), created in the next step.
4. After the bucket exists (Step 3), go to the user → **Add permissions →
   Create inline policy → JSON**, and paste (replace `YOUR_BUCKET_NAME`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::YOUR_BUCKET_NAME",
        "arn:aws:s3:::YOUR_BUCKET_NAME/*"
      ]
    }
  ]
}
```

5. Go to the user → **Security credentials → Access keys → Create access
   key** → choose "Application running outside AWS" → save the **Access
   key ID** and **Secret access key** somewhere safe. You'll only see the
   secret once.

---

## 3. Create the S3 bucket (AWS Console)

1. Go to **S3 → Create bucket**.
2. Bucket name must be globally unique, e.g. `vault-files-yourname-2026`.
3. Pick a region close to you (e.g. `ap-south-1` for India) — you'll use
   this same region in `.env`.
4. **Block all public access: keep this ON.** The app never makes objects
   public; downloads and shares work through short-lived presigned URLs
   instead, which is the secure pattern.
5. Leave everything else at default and create the bucket.
6. (Optional, only needed if you later call S3 directly from browser
   JavaScript instead of through this backend) — add a CORS
   configuration under **Permissions → CORS**:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["http://localhost:5000"],
    "ExposeHeaders": []
  }
]
```

This project uploads through the backend (not directly from the browser
to S3), so this step is optional — included for completeness/bonus.

---

## 4. Configure and run the backend locally

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and fill in:

```
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=<from step 2>
AWS_SECRET_ACCESS_KEY=<from step 2>
S3_BUCKET_NAME=<from step 3>
JWT_SECRET=<any long random string>
ADMIN_USER=admin
ADMIN_PASS=<pick a password>
```

Start the server:

```bash
npm run dev      # auto-restarts on changes (nodemon)
# or
npm start
```

You should see `Server running on http://localhost:5000`.

---

## 5. Use the app

Open **http://localhost:5000** in your browser (the backend serves the
frontend directly, so there's nothing else to start).

1. Sign in with the `ADMIN_USER` / `ADMIN_PASS` from your `.env`.
2. Drag a file onto the drop zone (or click "browse"). Allowed types:
   images, PDF, Word/Excel, text, zip, JSON — up to 10 MB (edit
   `backend/src/middleware/upload.js` to change this).
3. **View / Download** opens a 5-minute presigned S3 URL.
4. **Share** generates a presigned link with a expiry you choose (1
   hour / 24 hours / 7 days) that you can copy and send to anyone —
   they don't need to log in to use it.
5. **Delete** removes the object from S3 permanently.

---

## 6. How the pieces map to the assignment

| Requirement | Where it's implemented |
|---|---|
| Upload / download / view / delete | `filesController.js` + `files.js` routes |
| Cloud storage (S3) | `config/s3Client.js`, all controller calls |
| File validation | `middleware/upload.js` (MIME allow-list + 10 MB limit) |
| Basic access permissions | `middleware/auth.js` (JWT) + per-user S3 key prefix so users can only touch their own files |
| Bonus: shareable download links | `shareFile` controller — presigned URL with adjustable expiry |

---

## 7. Notes for going beyond a local demo

- **Multi-user auth:** swap the single hardcoded admin for **AWS Cognito**
  (or a real user table with hashed passwords) — the JWT middleware
  pattern stays the same, you'd just verify a Cognito-issued token instead.
- **Virus/malware scanning:** for a production app, scan uploads (e.g.
  with an S3 Lambda trigger + ClamAV or a service like Amazon GuardDuty
  Malware Protection for S3) before treating them as trusted.
- **HTTPS:** run behind a reverse proxy (Nginx) or an AWS Load Balancer
  with a TLS certificate — don't ship JWTs over plain HTTP outside of
  local development.
- **Deploying to AWS:** the backend is a stateless Express app, so it
  drops into **Elastic Beanstalk**, **AWS App Runner**, or an **EC2**
  instance with minimal changes — just set the same environment
  variables there. If you deploy to EC2/ECS, you can attach an IAM
  *role* instead of static keys and drop `AWS_ACCESS_KEY_ID` /
  `AWS_SECRET_ACCESS_KEY` from `.env` entirely.
