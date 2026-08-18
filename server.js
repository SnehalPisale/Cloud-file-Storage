require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const fileRoutes = require("./routes/files");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/files", fileRoutes);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Serve the plain HTML/JS frontend so the whole app runs from one origin
// (avoids CORS headaches when testing locally).
app.use(express.static(path.join(__dirname, "../../frontend")));

// Multer / general error handler (must come after routes)
app.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
