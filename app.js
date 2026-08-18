const API_BASE = "/api"; // served from the same origin as the backend

let authToken = null;
let currentUser = null;

// ---------- DOM refs ----------
const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const sessionInfo = document.getElementById("session-info");
const sessionUser = document.getElementById("session-user");

const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const browseBtn = document.getElementById("browse-btn");
const uploadStatus = document.getElementById("upload-status");

const fileListEl = document.getElementById("file-list");
const emptyState = document.getElementById("empty-state");
const refreshBtn = document.getElementById("refresh-btn");

const shareModal = document.getElementById("share-modal");
const shareUrlInput = document.getElementById("share-url");
const shareExpiry = document.getElementById("share-expiry");
const copyShareBtn = document.getElementById("copy-share-btn");
const closeShareBtn = document.getElementById("close-share-btn");

let shareModalKey = null;

// ---------- helpers ----------
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function showApp(username) {
  currentUser = username;
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
  sessionInfo.classList.remove("hidden");
  sessionUser.textContent = username;
  loadFiles();
}

function showLogin() {
  authToken = null;
  currentUser = null;
  sessionStorage.removeItem("vault_token");
  sessionStorage.removeItem("vault_user");
  loginView.classList.remove("hidden");
  appView.classList.add("hidden");
  sessionInfo.classList.add("hidden");
}

// ---------- auth ----------
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.add("hidden");
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  try {
    const data = await api("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    authToken = data.token;
    sessionStorage.setItem("vault_token", authToken);
    sessionStorage.setItem("vault_user", username);
    showApp(username);
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove("hidden");
  }
});

logoutBtn.addEventListener("click", showLogin);

// Restore session on page load
(function restoreSession() {
  const token = sessionStorage.getItem("vault_token");
  const user = sessionStorage.getItem("vault_user");
  if (token && user) {
    authToken = token;
    showApp(user);
  }
})();

// ---------- upload ----------
browseBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) uploadFile(fileInput.files[0]);
});

["dragenter", "dragover"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("drag-over");
  })
);
["dragleave", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag-over");
  })
);
dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (file) uploadFile(file);
});

async function uploadFile(file) {
  uploadStatus.classList.remove("hidden", "error", "success");
  uploadStatus.textContent = `Uploading ${file.name}...`;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(`${API_BASE}/files/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");

    uploadStatus.textContent = `Uploaded ${file.name}`;
    uploadStatus.classList.add("success");
    fileInput.value = "";
    loadFiles();
  } catch (err) {
    uploadStatus.textContent = err.message;
    uploadStatus.classList.add("error");
  }
}

// ---------- file list ----------
refreshBtn.addEventListener("click", loadFiles);

async function loadFiles() {
  try {
    const data = await api("/files");
    renderFiles(data.files || []);
  } catch (err) {
    if (err.message.includes("expired") || err.message.includes("Invalid")) {
      showLogin();
    }
  }
}

function renderFiles(files) {
  fileListEl.innerHTML = "";
  emptyState.classList.toggle("hidden", files.length > 0);

  files
    .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
    .forEach((file) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="file-name">${escapeHtml(file.name)}</td>
        <td class="file-meta">${formatBytes(file.size)}</td>
        <td class="file-meta">${formatDate(file.lastModified)}</td>
        <td class="actions-col">
          <div class="row-actions">
            <button class="btn btn-ghost small" data-action="view">View / Download</button>
            <button class="btn btn-ghost small" data-action="share">Share</button>
            <button class="btn btn-danger small" data-action="delete">Delete</button>
          </div>
        </td>
      `;
      tr.querySelector('[data-action="view"]').addEventListener("click", () => viewFile(file.key));
      tr.querySelector('[data-action="share"]').addEventListener("click", () => openShareModal(file.key));
      tr.querySelector('[data-action="delete"]').addEventListener("click", () => deleteFile(file.key, tr));
      fileListEl.appendChild(tr);
    });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function viewFile(key) {
  try {
    const data = await api(`/files/${encodeURIComponent(key)}/view`);
    window.open(data.url, "_blank");
  } catch (err) {
    alert(err.message);
  }
}

async function deleteFile(key, rowEl) {
  if (!confirm("Delete this file? This cannot be undone.")) return;
  try {
    await api(`/files/${encodeURIComponent(key)}`, { method: "DELETE" });
    rowEl.remove();
    if (!fileListEl.children.length) emptyState.classList.remove("hidden");
  } catch (err) {
    alert(err.message);
  }
}

// ---------- share modal ----------
function openShareModal(key) {
  shareModalKey = key;
  shareUrlInput.value = "";
  shareModal.classList.remove("hidden");
  generateShareLink();
}

shareExpiry.addEventListener("change", generateShareLink);

async function generateShareLink() {
  if (!shareModalKey) return;
  shareUrlInput.value = "Generating...";
  try {
    const data = await api(
      `/files/${encodeURIComponent(shareModalKey)}/share?expiresIn=${shareExpiry.value}`
    );
    shareUrlInput.value = data.shareUrl;
  } catch (err) {
    shareUrlInput.value = "";
    alert(err.message);
  }
}

copyShareBtn.addEventListener("click", () => {
  shareUrlInput.select();
  navigator.clipboard.writeText(shareUrlInput.value);
  copyShareBtn.textContent = "Copied!";
  setTimeout(() => (copyShareBtn.textContent = "Copy link"), 1500);
});

closeShareBtn.addEventListener("click", () => {
  shareModal.classList.add("hidden");
  shareModalKey = null;
});
