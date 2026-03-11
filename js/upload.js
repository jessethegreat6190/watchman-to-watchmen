// Upload page functionality
let selectedFiles = [];

document.addEventListener("DOMContentLoaded", async () => {
  await updateAdminStatus();
  checkAccess();
  initDropZone();
});

// Initialize drag and drop
function initDropZone() {
  const dropZone = document.getElementById("upload-drop-zone");
  const fileInput = document.getElementById("image-file");
  if (!dropZone || !fileInput) return;

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    handleMultipleFiles({ target: { files: e.dataTransfer.files } });
  });

  // Clipboard paste
  document.addEventListener("paste", (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        handleMultipleFiles({ target: { files: [file] } });
        break;
      }
    }
  });
}

// Handle multiple file selection
function handleMultipleFiles(event) {
  const files = Array.from(event.target.files);
  const validFiles = files.filter(file => {
    if (!file.type.startsWith("image/")) {
      showToast(`${file.name} is not an image`, "warning");
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast(`${file.name} exceeds 10MB`, "warning");
      return false;
    }
    return true;
  });

  selectedFiles = [...selectedFiles, ...validFiles];
  updateFilesPreview();
}

// Update files preview grid
function updateFilesPreview() {
  const container = document.getElementById("selected-files");
  const grid = document.getElementById("files-preview-grid");
  const countEl = document.getElementById("files-count");

  if (selectedFiles.length === 0) {
    container.style.display = "none";
    return;
  }

  container.style.display = "block";
  countEl.textContent = `${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""} selected`;
  grid.innerHTML = "";

  selectedFiles.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const div = document.createElement("div");
      div.style.cssText = "position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);";
      div.innerHTML = `
        <img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover;">
        <button onclick="removeFile(${index})" style="position: absolute; top: 4px; right: 4px; background: rgba(239, 68, 68, 0.9); border: none; color: white; border-radius: 50%; width: 22px; height: 22px; cursor: pointer; font-size: 14px; line-height: 1;">×</button>
        ${file.uploaded ? `<div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(16, 185, 129, 0.9); color: white; font-size: 10px; padding: 3px; text-align: center;">✓ Uploaded</div>` : ''}
      `;
      grid.appendChild(div);
    };
    reader.readAsDataURL(file);
  });
}

// Remove single file
function removeFile(index) {
  selectedFiles.splice(index, 1);
  updateFilesPreview();
}

// Clear all files
function clearAllFiles() {
  selectedFiles = [];
  document.getElementById("image-file").value = "";
  updateFilesPreview();
}

// Check if user has upload permission
async function checkAccess() {
  const user = auth.currentUser || { uid: "guest_uid" };
  
  const permissionDenied = document.getElementById("permission-denied");
  const uploadSection = document.getElementById("upload-section");
  
  // BYPASS: Always allow access
  if (permissionDenied) permissionDenied.style.display = "none";
  if (uploadSection) uploadSection.style.display = "block";
  
  loadBoardsForSelect();
  loadUserImages();
}

// Load user's boards for select dropdown
async function loadBoardsForSelect() {
  const user = auth.currentUser;
  if (!user) return;
  
  const boardSelect = document.getElementById("board-select");
  if (!boardSelect) return;
  
  try {
    const snapshot = await db.collection("boards")
      .where("createdByUid", "==", user.uid)
      .orderBy("name", "asc")
      .get();
      
    boardSelect.innerHTML = '<option value="">No Board (General)</option>';
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const option = document.createElement("option");
      option.value = doc.id;
      option.innerText = data.name;
      boardSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading boards for select:", error);
  }
}

// Upload multiple images
async function uploadMultipleImages() {
  const user = auth.currentUser;
  if (!user) {
    showToast("Please login first", "warning");
    toggleAuth();
    return;
  }

  const title = document.getElementById("image-title").value.trim();
  const description = document.getElementById("image-description").trim();
  const boardId = document.getElementById("board-select").value;
  const section = document.getElementById("image-section") ? document.getElementById("image-section").value.trim() : "";

  if (selectedFiles.length === 0) {
    showToast("Please select at least one image", "warning");
    return;
  }

  if (!title) {
    showToast("Title is required", "warning");
    return;
  }

  const uploadBtn = document.getElementById("upload-btn");
  const uploadProgress = document.getElementById("upload-progress");
  const progressBar = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");
  const progressPercent = document.getElementById("progress-percent");
  const progressDetails = document.getElementById("progress-details");
  const fileProgressList = document.getElementById("file-progress-list");

  uploadBtn.disabled = true;
  uploadProgress.style.display = "block";
  fileProgressList.style.display = "block";
  fileProgressList.innerHTML = "";

  const isAdmin = window.isCurrentUserAdmin;
  let uploadedCount = 0;
  const totalFiles = selectedFiles.length;

  for (let i = 0; i < selectedFiles.length; i++) {
    const file = selectedFiles[i];
    
    // Add file progress item
    const fileProgressItem = document.createElement("div");
    fileProgressItem.id = `file-progress-${i}`;
    fileProgressItem.style.cssText = "display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: rgba(255,255,255,0.03); border-radius: 10px; margin-bottom: 0.5rem; border: 1px solid rgba(255,255,255,0.05);";
    fileProgressItem.innerHTML = `
      <div style="width: 40px; height: 40px; border-radius: 8px; overflow: hidden; flex-shrink: 0;">
        <img id="thumb-${i}" style="width: 100%; height: 100%; object-fit: cover;">
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 600; font-size: 0.875rem; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${file.name}</div>
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
          <div style="flex: 1; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
            <div id="file-bar-${i}" style="height: 100%; width: 0%; background: linear-gradient(90deg, #6366f1, #8b5cf6); transition: width 0.3s;"></div>
          </div>
          <span id="file-percent-${i}" style="font-size: 0.75rem; color: #64748b; width: 40px; text-align: right;">0%</span>
        </div>
      </div>
      <div id="file-status-${i}" style="font-size: 1.25rem;"></div>
    `;
    fileProgressList.appendChild(fileProgressItem);
    
    // Show thumbnail
    const reader = new FileReader();
    reader.onload = (e) => {
      const thumb = document.getElementById(`thumb-${i}`);
      if (thumb) thumb.src = e.target.result;
    };
    reader.readAsDataURL(file);

    try {
      const timestamp = Date.now() + i;
      const filename = `${user.uid}/${timestamp}_${file.name}`;
      const fileRef = storage.ref(filename);
      
      const uploadTask = fileRef.put(file);
      
      await new Promise((resolve, reject) => {
        uploadTask.on("state_changed",
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            const rounded = Math.round(progress);
            const fileBar = document.getElementById(`file-bar-${i}`);
            const filePercent = document.getElementById(`file-percent-${i}`);
            if (fileBar) fileBar.style.width = rounded + "%";
            if (filePercent) filePercent.innerText = rounded + "%";
            
            // Update overall progress
            const overallProgress = ((uploadedCount * 100 + rounded) / totalFiles);
            if (progressBar) progressBar.style.width = Math.round(overallProgress) + "%";
            if (progressPercent) progressPercent.innerText = Math.round(overallProgress) + "%";
          },
          (error) => reject(error),
          async () => resolve()
        );
      });

      const downloadURL = await fileRef.getDownloadURL();
      
      const imageData = {
        title: title + (totalFiles > 1 ? ` (${i + 1}/${totalFiles})` : ""),
        description: description,
        url: downloadURL,
        uploadedBy: user.email,
        uploadedByUid: user.uid,
        isAdminUpload: isAdmin,
        createdAt: new Date(),
        fileSize: file.size,
        fileName: file.name,
        status: isAdmin ? "approved" : "pending",
        verifiedByAdmin: isAdmin,
        boardId: boardId || null,
        section: section || "General"
      };
      
      if (isAdmin) {
        imageData.approvedBy = user.uid;
        imageData.approvedAt = new Date();
      }
      
      await db.collection("images").add(imageData);
      
      // Update board count
      if (boardId) {
        const boardRef = db.collection("boards").doc(boardId);
        const boardDoc = await boardRef.get();
        if (boardDoc.exists) {
          await boardRef.update({
            pinCount: (boardDoc.data().pinCount || 0) + 1,
            coverImageUrl: boardDoc.data().coverImageUrl || downloadURL
          });
        }
      }
      
      // Update user count
      const userRef = db.collection("users").doc(user.uid);
      const userDoc = await userRef.get();
      await userRef.update({
        uploadCount: (userDoc.data().uploadCount || 0) + 1
      });
      
      uploadedCount++;
      file.uploaded = true;
      
      // Update file status
      const statusEl = document.getElementById(`file-status-${i}`);
      const fileBar = document.getElementById(`file-bar-${i}`);
      if (statusEl) statusEl.innerHTML = "✅";
      if (fileBar) fileBar.style.background = "linear-gradient(90deg, #10b981, #34d399)";
      
      // Update overall progress
      const overallProgress = (uploadedCount / totalFiles) * 100;
      if (progressBar) progressBar.style.width = Math.round(overallProgress) + "%";
      if (progressPercent) progressPercent.innerText = Math.round(overallProgress) + "%";
      if (progressText) progressText.innerText = `Uploading ${uploadedCount} of ${totalFiles}...`;
      
    } catch (error) {
      console.error("Upload error for file:", file.name, error);
      const statusEl = document.getElementById(`file-status-${i}`);
      if (statusEl) statusEl.innerHTML = "❌";
    }
  }

  // Complete
  const finalMessage = isAdmin 
    ? `Successfully published ${uploadedCount} image${uploadedCount > 1 ? "s" : ""}!`
    : `Submitted ${uploadedCount} image${uploadedCount > 1 ? "s" : ""} for review`;
  
  showToast(finalMessage, uploadedCount > 0 ? "success" : "error");
  
  if (progressText) progressText.innerText = "Complete!";
  if (progressDetails) progressDetails.innerText = `${uploadedCount} of ${totalFiles} uploaded successfully`;
  
  setTimeout(() => {
    resetUploadForm();
    loadUserImages();
  }, 1500);
}

function resetUploadForm() {
  const uploadBtn = document.getElementById("upload-btn");
  const uploadProgress = document.getElementById("upload-progress");
  const fileProgressList = document.getElementById("file-progress-list");
  
  document.getElementById("image-title").value = "";
  document.getElementById("image-description").value = "";
  document.getElementById("image-file").value = "";
  
  selectedFiles = [];
  updateFilesPreview();
  
  if (uploadBtn) {
    uploadBtn.disabled = false;
  }
  if (uploadProgress) uploadProgress.style.display = "none";
  if (fileProgressList) {
    fileProgressList.style.display = "none";
    fileProgressList.innerHTML = "";
  }
  
  const progressBar = document.getElementById("progress-bar");
  const progressPercent = document.getElementById("progress-percent");
  if (progressBar) progressBar.style.width = "0%";
  if (progressPercent) progressPercent.innerText = "0%";
}

// Load user's uploaded images
async function loadUserImages() {
  const user = auth.currentUser;
  if (!user) return;
  
  const userImagesDiv = document.getElementById("user-images");
  const noUploadDiv = document.getElementById("no-uploads");
  const isAdmin = window.isCurrentUserAdmin;
  
  try {
    userImagesDiv.innerHTML = '<div class="spinner"></div>';
    
    const snapshot = await db.collection("images")
      .where("uploadedByUid", "==", user.uid)
      .orderBy("createdAt", "desc")
      .get();
    
    if (snapshot.empty) {
      userImagesDiv.innerHTML = "";
      if (noUploadDiv) noUploadDiv.style.display = "block";
      return;
    }
    
    if (noUploadDiv) noUploadDiv.style.display = "none";
    userImagesDiv.innerHTML = "";
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const isPublished = data.status === "approved";
      
      const card = document.createElement("div");
      card.className = "image-card";
      if (data.isAdminUpload) card.classList.add("admin-image");
      
      const statusBadge = isPublished 
        ? '<span class="image-badge badge-verified">✅ Published</span>'
        : '<span class="image-badge badge-pending">⏳ Pending</span>';
      
      card.innerHTML = `
        <img src="${data.url}" alt="${data.title}" style="cursor: pointer;" onclick="window.open('${data.url}', '_blank')">
        <div class="image-info">
          ${statusBadge}
          <h3>${data.title}</h3>
          ${data.description ? `<p>${data.description}</p>` : ''}
          <div style="display: flex; gap: 0.5rem; margin-top: 1rem; flex-wrap: wrap;">
            ${isAdmin ? `
              <button onclick="togglePublishImage('${doc.id}', ${!isPublished})" 
                style="flex: 1; padding: 0.5rem; border-radius: 8px; font-size: 0.8125rem; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s;
                ${isPublished 
                  ? 'background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2);' 
                  : 'background: linear-gradient(135deg, #10b981, #059669); color: white; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);'}">
                ${isPublished ? '📭 Unpublish' : '🚀 Publish'}
              </button>
            ` : ''}
            <button onclick="deleteImage('${doc.id}', '${data.url}')" 
              style="flex: 1; padding: 0.5rem; border-radius: 8px; font-size: 0.8125rem; font-weight: 600; cursor: pointer; background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); transition: all 0.2s;">
              🗑️ Delete
            </button>
          </div>
        </div>
      `;
      userImagesDiv.appendChild(card);
    });
  } catch (error) {
    console.error("Error loading user images:", error);
    userImagesDiv.innerHTML = '<p style="text-align: center; color: #94a3b8;">Failed to load your collection.</p>';
  }
}

// Toggle publish status
async function togglePublishImage(imageId, publish) {
  if (!confirm(publish ? "Publish this image to the gallery?" : "Remove this image from the gallery?")) return;
  
  try {
    await db.collection("images").doc(imageId).update({
      status: publish ? "approved" : "pending",
      verifiedByAdmin: publish,
      approvedAt: publish ? new Date() : null,
      approvedBy: publish ? auth.currentUser.uid : null
    });
    
    showToast(publish ? "Image published to gallery!" : "Image removed from gallery", "success");
    loadUserImages();
  } catch (error) {
    console.error("Error toggling publish:", error);
    showToast("Failed to update image", "error");
  }
}

// Delete image
async function deleteImage(imageId, imageUrl) {
  if (!confirm("Are you sure you want to delete this image? This cannot be undone.")) return;
  
  try {
    // Delete from storage
    try {
      const fileRef = storage.refFromURL(imageUrl);
      await fileRef.delete();
    } catch (e) {
      console.log("Storage file already deleted or not found");
    }
    
    // Delete from Firestore
    await db.collection("images").doc(imageId).delete();
    
    showToast("Image deleted", "success");
    loadUserImages();
  } catch (error) {
    console.error("Error deleting image:", error);
    showToast("Failed to delete image", "error");
  }
}

// Legacy function - kept for backwards compatibility
function previewImage(event) {
  handleMultipleFiles(event);
}
