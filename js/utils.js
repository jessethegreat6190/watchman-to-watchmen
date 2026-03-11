// Utility functions for Watchman to Watchmen
// Create image card element with Reactions and Lightbox
function createImageCard(imageId, data, isGallery = false) {
  const card = document.createElement("div");
  card.className = "image-card";
  if (data.isAdminUpload) card.classList.add("admin-image");
  if (data.status === "pending") card.classList.add("pending-image");
  if (data.status === "rejected") card.classList.add("rejected-image");
  
  const uploadedBy = data.uploadedBy || "Unknown";
  const uploadDate = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString() : "N/A";
  const likesCount = data.likesCount || 0;
  
  let badgesHTML = "";
  if (data.isAdminUpload) badgesHTML += '<span class="image-badge badge-admin">👑 Admin Upload</span>';
  if (data.status === "approved") badgesHTML += '<span class="image-badge badge-verified">✓ Verified</span>';
  
  const isOwnerOrAdmin = auth.currentUser && (auth.currentUser.uid === data.uploadedByUid || window.isCurrentUserAdmin);
  const userLiked = data.likedBy && auth.currentUser && data.likedBy.includes(auth.currentUser.uid);

  card.innerHTML = `
    <img src="${data.url}" alt="${data.title}" onclick="openLightbox('${imageId}')" style="cursor: zoom-in;">
    <div class="image-info">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>${badgesHTML}</div>
        <button class="heart-btn ${userLiked ? 'active' : ''}" onclick="toggleHeart(event, '${imageId}')">
          ${userLiked ? '❤️' : '🤍'} <span style="font-size: 0.8rem; font-weight: 700;">${likesCount}</span>
        </button>
      </div>
      <h3 onclick="openLightbox('${imageId}')" style="cursor: pointer;">${data.title || "Untitled"}</h3>
      <p style="font-size: 0.8rem; color: #999; margin-bottom: 0.5rem;">${isGallery ? `By: ${uploadedBy} • ` : ""}${uploadDate}</p>
      <div class="image-actions">
        <button class="btn-download" onclick="downloadImage('${data.url}', '${data.title || 'image'}')">⬇️ Download</button>
        ${isOwnerOrAdmin ? `<button class="btn-delete" onclick="handleDeleteImage('${imageId}', '${isGallery ? 'gallery' : 'upload'}')">🗑️</button>` : ""}
      </div>
    </div>
  `;
  return card;
}

// Lightbox logic
async function openLightbox(imageId) {
  try {
    const doc = await db.collection("images").doc(imageId).get();
    if (!doc.exists) return;
    const data = doc.data();
    
    let lightbox = document.getElementById("lightbox");
    if (!lightbox) {
      lightbox = document.createElement("div");
      lightbox.id = "lightbox";
      lightbox.className = "lightbox";
      document.body.appendChild(lightbox);
    }
    
    const userLiked = data.likedBy && auth.currentUser && data.likedBy.includes(auth.currentUser.uid);
    const uploadedBy = data.uploadedBy || "Unknown";
    const uploadDate = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString() : "N/A";
    const comments = data.comments || [];

    lightbox.innerHTML = `
      <button class="lightbox-close" onclick="closeLightbox()">&times;</button>
      <div class="lightbox-content">
        <div class="lightbox-img-container">
          <img src="${data.url}" alt="${data.title}">
        </div>
        <div class="lightbox-info">
          <div style="flex: 1; overflow-y: auto; padding-right: 0.5rem;">
            <h2 style="font-weight: 800; font-size: 1.75rem;">${data.title || 'Untitled'}</h2>
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
              <button class="heart-btn ${userLiked ? 'active' : ''}" onclick="toggleHeart(event, '${imageId}', true)">
                ${userLiked ? '❤️' : '🤍'} <span>${data.likesCount || 0} Likes</span>
              </button>
            </div>
            <p style="color: var(--text-secondary); line-height: 1.6;">${data.description || "No description provided."}</p>
            <hr style="border: none; border-top: 1px solid var(--border-color); margin: 1rem 0;">
            <p style="font-size: 0.9rem;"><strong>Uploaded By:</strong> ${uploadedBy}</p>
            <p style="font-size: 0.9rem;"><strong>Date:</strong> ${uploadDate}</p>
            
            <h3 style="margin-top: 1.5rem; font-size: 1.1rem;">Comments (${comments.length})</h3>
            <div id="comments-list" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 1rem;">
              ${comments.length === 0 ? '<p style="color: #94a3b8; font-style: italic;">No comments yet. Be the first!</p>' : 
                comments.map(c => `
                  <div class="comment" style="background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: 12px; border-left: 3px solid #6366f1;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                      <span style="font-weight: 700; font-size: 0.85rem;">${c.userName}</span>
                      <span style="font-size: 0.75rem; color: #64748b;">${new Date(c.createdAt.toDate ? c.createdAt.toDate() : c.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p style="font-size: 0.9rem; margin: 0; line-height: 1.4;">${c.text}</p>
                  </div>
                `).join('')
              }
            </div>
          </div>

          <div style="margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem;">
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
              <input type="text" id="comment-text" placeholder="Add a comment..." style="flex: 1; padding: 0.75rem; border-radius: 12px; background: #0f172a; border: 1px solid #334155; color: #fff;">
              <button class="btn-primary" onclick="submitComment('${imageId}')" style="padding: 0.75rem 1.25rem;">Post</button>
            </div>

            <h3 style="margin-top: 1rem; font-size: 1rem;">Share Inspiration</h3>
            <div class="share-options" style="margin-bottom: 1.5rem;">
              <button class="share-btn" onclick="shareImage('whatsapp', '${data.url}', '${data.title}')" title="WhatsApp">🟢</button>
              <button class="share-btn" onclick="shareImage('twitter', '${data.url}', '${data.title}')" title="Twitter">🔵</button>
              <button class="share-btn" onclick="shareImage('copy', '${data.url}', '${data.title}')" title="Copy Link">🔗</button>
            </div>
            <button class="btn-primary" style="width: 100%;" onclick="downloadImage('${data.url}', '${data.title}')">Download HD</button>
          </div>
        </div>
      </div>
    `;
    lightbox.style.display = "flex";
    document.body.style.overflow = "hidden";
    lightbox.onclick = (e) => { if (e.target === lightbox) closeLightbox(); };
  } catch (err) { console.error(err); }
}

function closeLightbox() {
  const lb = document.getElementById("lightbox");
  if (lb) lb.style.display = "none";
  document.body.style.overflow = "auto";
}

async function toggleHeart(event, imageId, fromLightbox = false) {
  if (event) event.stopPropagation();
  if (!auth.currentUser) { showToast("Please login to react", "warning"); return; }
  const uid = auth.currentUser.uid;
  const imageRef = db.collection("images").doc(imageId);
  try {
    const doc = await imageRef.get();
    const data = doc.data();
    const likedBy = data.likedBy || [];
    const isLiked = likedBy.includes(uid);
    if (isLiked) {
      await imageRef.update({ likedBy: firebase.firestore.FieldValue.arrayRemove(uid), likesCount: firebase.firestore.FieldValue.increment(-1) });
    } else {
      await imageRef.update({ likedBy: firebase.firestore.FieldValue.arrayUnion(uid), likesCount: firebase.firestore.FieldValue.increment(1) });
      
      // Notify owner
      if (data.uploadedByUid !== uid) {
        createNotification(data.uploadedByUid, 'like', imageId, data.title);
      }
    }
    
    if (fromLightbox) {
      openLightbox(imageId);
    } else {
      if (typeof renderGallery === 'function') {
        const updatedDoc = await imageRef.get();
        const updatedData = updatedDoc.data();
        if (typeof allImages !== 'undefined') {
          const idx = allImages.findIndex(img => img.id === imageId);
          if (idx !== -1) allImages[idx] = { id: imageId, ...updatedData };
        }
        renderGallery();
      } else if (typeof loadGallery === 'function') {
        loadGallery();
      } else if (typeof loadUserImages === 'function') {
        loadUserImages();
      }
    }
  } catch (err) { console.error(err); }
}

function shareImage(platform, url, title) {
  const text = encodeURIComponent(`Check out this inspiration: ${title} - `);
  const link = encodeURIComponent(url);
  if (platform === 'whatsapp') window.open(`https://wa.me/?text=${text}${link}`, '_blank');
  else if (platform === 'twitter') window.open(`https://twitter.com/intent/tweet?text=${text}&url=${link}`, '_blank');
  else if (platform === 'copy') { navigator.clipboard.writeText(url); showToast("Link copied!", "success"); }
}

async function downloadImage(url, title) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${title || 'watchmen'}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (e) { window.open(url, '_blank'); }
}

async function handleDeleteImage(imageId, source) {
  if (!confirm("Delete forever?")) return;
  try {
    const doc = await db.collection("images").doc(imageId).get();
    await firebase.storage().refFromURL(doc.data().url).delete();
    await db.collection("images").doc(imageId).delete();
    location.reload();
  } catch (e) { console.error(e); }
}

function showToast(message, type = "info") {
  let c = document.getElementById("toast-container");
  if (!c) { c = document.createElement("div"); c.id = "toast-container"; document.body.appendChild(c); }
  const t = document.createElement("div"); t.className = `toast ${type}`; t.innerText = message;
  c.appendChild(t); setTimeout(() => { t.remove(); }, 3000);
}

window.isCurrentUserAdmin = false;
async function updateAdminStatus() {
  const user = auth.currentUser;
  if (!user) return false;
  const doc = await db.collection("users").doc(user.uid).get();
  window.isCurrentUserAdmin = doc.exists && doc.data().role === "admin";
  return window.isCurrentUserAdmin;
}

async function submitComment(imageId) {
  const input = document.getElementById("comment-text");
  const text = input.value.trim();
  if (!text) return;
  
  const user = auth.currentUser;
  if (!user) {
    showToast("Please login to comment", "warning");
    toggleAuth();
    return;
  }
  
  try {
    const doc = await db.collection("images").doc(imageId).get();
    const data = doc.data();
    
    const comment = {
      uid: user.uid,
      userName: user.displayName || user.email.split('@')[0],
      text: text,
      createdAt: new Date()
    };
    
    await db.collection("images").doc(imageId).update({
      comments: firebase.firestore.FieldValue.arrayUnion(comment)
    });
    
    // Notify owner
    if (data.uploadedByUid !== user.uid) {
      createNotification(data.uploadedByUid, 'comment', imageId, data.title);
    }
    
    input.value = "";
    openLightbox(imageId); // Refresh lightbox to show new comment
  } catch (error) {
    console.error("Error submitting comment:", error);
    showToast("Failed to post comment", "error");
  }
}

// Notification Functions
async function createNotification(recipientUid, type, relatedId, relatedTitle = "") {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid === recipientUid) return;
  
  try {
    await db.collection("notifications").add({
      recipientUid,
      senderUid: currentUser.uid,
      senderName: currentUser.displayName || currentUser.email.split('@')[0],
      type,
      relatedId,
      relatedTitle,
      read: false,
      createdAt: new Date()
    });
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}

let notificationListener = null;
function listenForNotifications() {
  const user = auth.currentUser;
  if (!user) return;
  
  const countEl = document.getElementById("notification-count");
  if (!countEl) return;
  
  if (notificationListener) notificationListener(); // Unsubscribe if exists
  
  notificationListener = db.collection("notifications")
    .where("recipientUid", "==", user.uid)
    .where("read", "==", false)
    .onSnapshot(snapshot => {
      const count = snapshot.size;
      if (count > 0) {
        countEl.innerText = count;
        countEl.style.display = "block";
      } else {
        countEl.style.display = "none";
      }
    });
}
