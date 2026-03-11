// Upload page functionality
document.addEventListener("DOMContentLoaded", async () => {
  await updateAdminStatus();
  checkAccess();
});

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
      
    // Keep the "No Board" option
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

// Upload image
async function uploadImage() {
  const user = auth.currentUser;
  if (!user) {
    showToast("Please login first", "warning");
    toggleAuth();
    return;
  }
  
  const title = document.getElementById("image-title").value.trim();
  const description = document.getElementById("image-description").value.trim();
  const file = document.getElementById("image-file").files[0];
  const boardId = document.getElementById("board-select").value;
  const section = document.getElementById("image-section") ? document.getElementById("image-section").value.trim() : "";
  
  if (!title || !file) {
    showToast("Title and image are required", "warning");
    return;
  }
  
  if (file.size > 10 * 1024 * 1024) {
    showToast("Max file size is 10MB", "error");
    return;
  }
  
  const uploadBtn = document.getElementById("upload-btn");
  const uploadProgress = document.getElementById("upload-progress");
  const progressBar = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");
  const progressPercent = document.getElementById("progress-percent");
  
  uploadBtn.disabled = true;
  uploadBtn.classList.add("btn-loading");
  uploadProgress.style.display = "block";
  
  try {
    const timestamp = Date.now();
    const filename = `${user.uid}/${timestamp}_${file.name}`;
    const fileRef = storage.ref(filename);
    const uploadTask = fileRef.put(file);
    
    uploadTask.on("state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        const rounded = Math.round(progress);
        if (progressText) progressText.innerText = `Sending file...`;
        if (progressPercent) progressPercent.innerText = `${rounded}%`;
        if (progressBar) progressBar.style.width = rounded + "%";
      },
      (error) => {
        console.error("Upload error:", error);
        showToast("Upload failed: " + error.message, "error");
        resetUploadForm();
      },
      async () => {
        const downloadURL = await fileRef.getDownloadURL();
        const isAdmin = window.isCurrentUserAdmin;
        const imageStatus = isAdmin ? "approved" : "pending";
        
        const imageData = {
          title,
          description,
          url: downloadURL,
          uploadedBy: user.email,
          uploadedByUid: user.uid,
          isAdminUpload: isAdmin,
          createdAt: new Date(),
          fileSize: file.size,
          fileName: file.name,
          status: imageStatus,
          verifiedByAdmin: isAdmin,
          boardId: boardId || null,
          section: section || "General"
        };
        
        if (isAdmin) {
          imageData.approvedBy = user.uid;
          imageData.approvedAt = new Date();
        }
        
        await db.collection("images").add(imageData);
        
        // Update board count if assigned to board
        if (boardId) {
          const boardRef = db.collection("boards").doc(boardId);
          const boardDoc = await boardRef.get();
          if (boardDoc.exists) {
            await boardRef.update({
              pinCount: (boardDoc.data().pinCount || 0) + 1,
              // Update cover image if it doesn't have one
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
        
        showToast(isAdmin ? "Successfully published!" : "Submitted for admin review", "success");
        resetUploadForm();
        loadUserImages();
      }
    );
  } catch (error) {
    console.error("Error uploading image:", error);
    showToast("Error during upload process", "error");
    resetUploadForm();
  }
}

function resetUploadForm() {
  const uploadBtn = document.getElementById("upload-btn");
  const uploadProgress = document.getElementById("upload-progress");
  document.getElementById("image-title").value = "";
  document.getElementById("image-description").value = "";
  document.getElementById("image-file").value = "";
  if (uploadBtn) {
    uploadBtn.disabled = false;
    uploadBtn.classList.remove("btn-loading");
  }
  if (uploadProgress) uploadProgress.style.display = "none";
}

// Load user's uploaded images
async function loadUserImages() {
  const user = auth.currentUser;
  if (!user) return;
  
  const userImagesDiv = document.getElementById("user-images");
  const noUploadDiv = document.getElementById("no-uploads");
  
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
      userImagesDiv.appendChild(createImageCard(doc.id, doc.data(), false));
    });
  } catch (error) {
    console.error("Error loading user images:", error);
    userImagesDiv.innerHTML = '<p style="text-align: center; color: #94a3b8;">Failed to load your collection.</p>';
  }
}

// Preview selected image
function previewImage(event) {
  const file = event.target.files[0];
  const previewContainer = document.getElementById("image-preview");
  const previewImg = document.getElementById("preview-img");
  
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      previewImg.src = e.target.result;
      previewContainer.style.display = "block";
    };
    reader.readAsDataURL(file);
  } else {
    removeSelectedFile();
  }
}

// Remove selected file and preview
function removeSelectedFile() {
  document.getElementById("image-file").value = "";
  document.getElementById("image-preview").style.display = "none";
  document.getElementById("preview-img").src = "";
}
