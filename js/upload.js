// Upload page functionality
document.addEventListener("DOMContentLoaded", async () => {
  await updateAdminStatus();
  checkAccess();
});

// Check if user has upload permission
async function checkAccess() {
  const user = auth.currentUser;
  if (!user) {
    // Show empty state with login prompt if not logged in
    document.getElementById("permission-denied").style.display = "block";
    document.getElementById("upload-section").style.display = "none";
    return;
  }
  
  const hasPermission = await hasUploadPermission(user.uid);
  const permissionDenied = document.getElementById("permission-denied");
  const uploadSection = document.getElementById("upload-section");
  
  if (!hasPermission) {
    permissionDenied.style.display = "block";
    uploadSection.style.display = "none";
    return;
  }
  
  permissionDenied.style.display = "none";
  uploadSection.style.display = "block";
  loadUserImages();
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
          verifiedByAdmin: isAdmin
        };
        
        if (isAdmin) {
          imageData.approvedBy = user.uid;
          imageData.approvedAt = new Date();
        }
        
        await db.collection("images").add(imageData);
        
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
