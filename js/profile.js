// User Profile Management logic
let profileUid = null;
let profileData = null;

document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  profileUid = urlParams.get("uid");
  
  if (!profileUid) {
    auth.onAuthStateChanged(user => {
      if (user) {
        window.location.href = `profile.html?uid=${user.uid}`;
      } else {
        window.location.href = "index.html";
      }
    });
    return;
  }
  
  loadProfile();
});

async function loadProfile() {
  const profileName = document.getElementById("profile-name");
  const profileEmail = document.getElementById("profile-email");
  const profilePhoto = document.getElementById("profile-photo");
  const followerCount = document.getElementById("follower-count");
  const followingCount = document.getElementById("following-count");
  const followBtn = document.getElementById("follow-btn");
  const editProfileBtn = document.getElementById("edit-profile-btn");
  const editPhotoBtn = document.getElementById("edit-photo-btn");
  
  try {
    const doc = await db.collection("users").doc(profileUid).get();
    if (!doc.exists) {
      profileName.innerText = "User not found";
      return;
    }
    
    profileData = doc.data();
    const currentUser = auth.currentUser;
    const isOwnProfile = currentUser && currentUser.uid === profileUid;
    
    profileName.innerText = profileData.displayName || profileData.email.split('@')[0];
    profileEmail.innerText = isOwnProfile ? profileData.email : "";
    if (profileData.photoURL) profilePhoto.src = profileData.photoURL;
    else profilePhoto.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profileName.innerText)}&background=6366f1&color=fff&size=128`;
    
    followerCount.innerText = (profileData.followers || []).length;
    followingCount.innerText = (profileData.following || []).length;
    
    if (isOwnProfile) {
      editProfileBtn.style.display = "block";
      editPhotoBtn.style.display = "block";
    } else if (currentUser) {
      followBtn.style.display = "block";
      const isFollowing = (profileData.followers || []).includes(currentUser.uid);
      followBtn.innerText = isFollowing ? "Unfollow" : "Follow";
      followBtn.style.background = isFollowing ? "#334155" : "#6366f1";
    }
    
    switchTab('pins');
  } catch (error) {
    console.error("Error loading profile:", error);
    showToast("Error loading profile", "error");
  }
}

async function switchTab(tab) {
  const pinsTab = document.getElementById("pins-tab");
  const boardsTab = document.getElementById("boards-tab");
  const content = document.getElementById("profile-content");
  
  pinsTab.classList.toggle("active", tab === 'pins');
  boardsTab.classList.toggle("active", tab === 'boards');
  
  if (tab === 'pins') {
    pinsTab.style.color = "#fff";
    pinsTab.style.borderBottom = "3px solid #6366f1";
    boardsTab.style.color = "#94a3b8";
    boardsTab.style.borderBottom = "none";
    loadUserPins();
  } else {
    boardsTab.style.color = "#fff";
    boardsTab.style.borderBottom = "3px solid #6366f1";
    pinsTab.style.color = "#94a3b8";
    pinsTab.style.borderBottom = "none";
    loadUserBoards();
  }
}

async function loadUserPins() {
  const content = document.getElementById("profile-content");
  content.innerHTML = '<div class="spinner"></div>';
  
  try {
    const snapshot = await db.collection("images")
      .where("uploadedByUid", "==", profileUid)
      .where("status", "==", "approved")
      .orderBy("createdAt", "desc")
      .get();
      
    content.innerHTML = "";
    if (snapshot.empty) {
      content.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #94a3b8;">No pins found.</div>';
    } else {
      snapshot.forEach(doc => {
        content.appendChild(createImageCard(doc.id, doc.data(), false));
      });
    }
  } catch (error) {
    console.error("Error loading pins:", error);
    content.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #ef4444;">Error loading pins.</div>';
  }
}

async function loadUserBoards() {
  const content = document.getElementById("profile-content");
  content.innerHTML = '<div class="spinner"></div>';
  
  try {
    const snapshot = await db.collection("boards")
      .where("createdByUid", "==", profileUid)
      .orderBy("createdAt", "desc")
      .get();
      
    content.innerHTML = "";
    if (snapshot.empty) {
      content.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #94a3b8;">No boards found.</div>';
    } else {
      snapshot.forEach(doc => {
        content.appendChild(createBoardCard(doc.id, doc.data()));
      });
    }
  } catch (error) {
    console.error("Error loading boards:", error);
  }
}

async function toggleFollow() {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    showToast("Please login to follow users", "warning");
    toggleAuth();
    return;
  }
  
  const followBtn = document.getElementById("follow-btn");
  followBtn.disabled = true;
  
  try {
    const userRef = db.collection("users").doc(currentUser.uid);
    const targetRef = db.collection("users").doc(profileUid);
    
    const isFollowing = (profileData.followers || []).includes(currentUser.uid);
    
    const batch = db.batch();
    
    if (isFollowing) {
      batch.update(targetRef, { followers: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
      batch.update(userRef, { following: firebase.firestore.FieldValue.arrayRemove(profileUid) });
    } else {
      batch.update(targetRef, { followers: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
      batch.update(userRef, { following: firebase.firestore.FieldValue.arrayUnion(profileUid) });
      
      // Notify target user
      createNotification(profileUid, 'follow', currentUser.uid, currentUser.displayName || currentUser.email.split('@')[0]);
    }
    
    await batch.commit();
    showToast(isFollowing ? "Unfollowed" : "Following", "success");
    loadProfile();
  } catch (error) {
    console.error("Error toggling follow:", error);
    showToast("Error updating follow status", "error");
  } finally {
    followBtn.disabled = false;
  }
}

function createBoardCard(boardId, data) {
  const card = document.createElement("div");
  card.className = "image-card board-card";
  card.style.background = "#1e293b";
  card.style.border = "1px solid rgba(255, 255, 255, 0.1)";
  card.style.cursor = "pointer";
  card.onclick = () => {
    window.location.href = `boards.html`; // Simplification for now
  };

  const coverUrl = data.coverImageUrl || "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?q=80&w=1887&auto=format&fit=crop";
  
  card.innerHTML = `
    <div style="height: 200px; width: 100%; overflow: hidden;">
      <img src="${coverUrl}" alt="${data.name}" style="width: 100%; height: 100%; object-fit: cover;">
    </div>
    <div style="padding: 1.5rem;">
      <h3 style="margin: 0; font-size: 1.25rem; color: #fff;">${data.name}</h3>
      <p style="color: #94a3b8; font-size: 0.875rem; margin-top: 0.5rem;">${data.pinCount || 0} Pins</p>
    </div>
  `;
  
  return card;
}

function openEditProfileModal() {
  document.getElementById("edit-profile-modal").style.display = "flex";
  document.getElementById("edit-name").value = profileData.displayName || "";
  document.getElementById("edit-bio").value = profileData.bio || "";
}

function closeEditProfileModal() {
  document.getElementById("edit-profile-modal").style.display = "none";
}

async function saveProfile() {
  const name = document.getElementById("edit-name").value.trim();
  const bio = document.getElementById("edit-bio").value.trim();
  
  if (!name) {
    showToast("Name is required", "warning");
    return;
  }
  
  try {
    await db.collection("users").doc(profileUid).update({
      displayName: name,
      bio: bio
    });
    
    // Also update auth profile if it's the current user
    if (auth.currentUser && auth.currentUser.uid === profileUid) {
      await auth.currentUser.updateProfile({
        displayName: name
      });
    }
    
    showToast("Profile updated", "success");
    closeEditProfileModal();
    loadProfile();
  } catch (error) {
    console.error("Error updating profile:", error);
    showToast("Error updating profile", "error");
  }
}

async function uploadProfilePhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (file.size > 2 * 1024 * 1024) {
    showToast("Max size 2MB", "error");
    return;
  }
  
  showToast("Uploading photo...", "info");
  
  try {
    const storageRef = firebase.storage().ref(`profiles/${profileUid}`);
    await storageRef.put(file);
    const photoURL = await storageRef.getDownloadURL();
    
    await db.collection("users").doc(profileUid).update({ photoURL });
    
    if (auth.currentUser && auth.currentUser.uid === profileUid) {
      await auth.currentUser.updateProfile({ photoURL });
    }
    
    showToast("Photo updated", "success");
    loadProfile();
  } catch (error) {
    console.error("Error uploading photo:", error);
    showToast("Error uploading photo", "error");
  }
}
