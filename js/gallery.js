let allImages = [];
// Gallery functionality
// Load gallery on page load
document.addEventListener("DOMContentLoaded", async () => {
  await updateAdminStatus(); // Initial admin check
  loadGallery();
});

// Load images from Firestore
async function loadGallery() {
  const gallery = document.getElementById("gallery");
  if (!gallery) return;
  
  try {
    gallery.innerHTML = '<div class="spinner"></div>';
    
    const snapshot = await db.collection("images")
      .where("status", "==", "approved")
      .orderBy("createdAt", "desc")
      .get();
      
    allImages = [];
    snapshot.forEach(doc => {
      allImages.push({ id: doc.id, ...doc.data() });
    });
    
    renderGallery();
  } catch (error) {
    console.error("Error loading gallery:", error);
    if (gallery) gallery.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: white; padding: 2rem;"><h3>Error loading gallery</h3><p>' + error.message + '</p></div>';
  }
}

function renderGallery() {
  const gallery = document.getElementById("gallery");
  const emptyState = document.getElementById("empty-state");
  if (!gallery) return;
  
  gallery.innerHTML = "";
  
  if (allImages.length === 0) {
    if (emptyState) emptyState.style.display = "block";
    return;
  }
  
  if (emptyState) emptyState.style.display = "none";
  
  allImages.forEach(img => {
    const card = createImageCard(img.id, img, true);
    gallery.appendChild(card);
  });
}

// Check for pending image approvals (ADMIN ONLY)
async function checkForPendingApprovals() {
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    const isAdmin = await updateAdminStatus();
    if (!isAdmin) return;
    
    const snapshot = await db.collection("images")
      .where("status", "==", "pending")
      .get();
    
    let banner = document.getElementById("pending-approvals-banner");
    
    if (snapshot.size > 0) {
      if (!banner) {
        banner = document.createElement("div");
        banner.id = "pending-approvals-banner";
        document.body.insertBefore(banner, document.body.firstChild);
      }
      banner.innerHTML = `
        <span>⏳ ${snapshot.size} images waiting for review</span>
        <a href="#" onclick="showPendingApprovals(event)">Review Now</a>
      `;
      banner.style.display = "flex";
    } else if (banner) {
      banner.style.display = "none";
    }
  } catch (error) {
    console.error("Error checking pending approvals:", error);
  }
}

// Show pending images for admin approval
async function showPendingApprovals(event) {
  if (event) event.preventDefault();
  
  try {
    const snapshot = await db.collection("images")
      .where("status", "==", "pending")
      .orderBy("createdAt", "desc")
      .get();
    
    let modal = document.getElementById("pending-approval-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "pending-approval-modal";
      modal.className = "modal-overlay";
      document.body.appendChild(modal);
    }
    
    let content = `
      <div class="modal-content">
        <h2>📋 Pending Image Approvals (${snapshot.size})</h2>
        <div class="modal-grid">
    `;
    
    if (snapshot.empty) {
      content += '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">✓ All caught up!</div>';
    } else {
      snapshot.forEach(doc => {
        const data = doc.data();
        const uploadDate = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString() : "N/A";
        content += `
          <div class="modal-item">
            <img src="${data.url}" alt="${data.title}" onclick="window.open('${data.url}', '_blank')">
            <div class="modal-item-info">
              <p style="font-weight: bold; margin-bottom: 0.2rem;">${data.title}</p>
              <p style="font-size: 0.8rem; color: #666; margin-bottom: 0.5rem;">By: ${data.uploadedBy}</p>
              <div class="image-actions">
                <button onclick="handleApprove('${doc.id}')" class="btn-download" style="background: #27ae60;">✓ Approve</button>
                <button onclick="handleReject('${doc.id}')" class="btn-delete">✗ Reject</button>
              </div>
            </div>
          </div>
        `;
      });
    }
    
    content += `
        </div>
        <button onclick="closePendingModal()" class="modal-close-btn">Close</button>
      </div>
    `;
    
    modal.innerHTML = content;
    modal.style.display = "flex";
    
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closePendingModal();
    });
  } catch (error) {
    console.error("Error showing pending approvals:", error);
    showToast("Error loading approvals", "error");
  }
}

async function handleApprove(imageId) {
  const imageRef = db.collection("images").doc(imageId);
  try {
    await imageRef.update({
      status: "approved",
      approvedAt: new Date(),
      approvedBy: auth.currentUser.uid
    });
    showToast("Image approved!", "success");
    showPendingApprovals();
    loadGallery();
    checkForPendingApprovals();
  } catch (error) {
    console.error("Error approving image:", error);
    showToast("Error approving image", "error");
  }
}

async function handleReject(imageId) {
  const reason = prompt("Enter rejection reason (optional):");
  if (reason !== null) {
    const imageRef = db.collection("images").doc(imageId);
    try {
      await imageRef.update({
        status: "rejected",
        rejectionReason: reason,
        rejectedAt: new Date(),
        rejectedBy: auth.currentUser.uid
      });
      showToast("Image rejected", "warning");
      showPendingApprovals();
      checkForPendingApprovals();
    } catch (error) {
      console.error("Error rejecting image:", error);
      showToast("Error rejecting image", "error");
    }
  }
}

function closePendingModal() {
  const modal = document.getElementById("pending-approval-modal");
  if (modal) modal.style.display = "none";
}
