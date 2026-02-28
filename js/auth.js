// Authentication and User Management

let isLoginMode = true;

// Sign up new user
async function signUpUser(email, password) {
  try {
    const result = await auth.createUserWithEmailAndPassword(email, password);
    const uid = result.user.uid;
    
    const emailConsent = document.getElementById("email-consent") ? document.getElementById("email-consent").checked : false;
    await db.collection("users").doc(uid).set({
      email: email,
      role: "viewer",
      doorPass: false,
      createdAt: new Date(),
      uploadCount: 0,
      emailConsent: emailConsent
    });
    
    showToast("Account created successfully!", "success");
    return result.user;
  } catch (error) {
    console.error("Sign up error:", error.message);
    showToast("Sign up failed: " + error.message, "error");
  }
}

// Login user
async function loginUser(email, password) {
  try {
    const result = await auth.signInWithEmailAndPassword(email, password);
    showToast("Welcome back!", "success");
    return result.user;
  } catch (error) {
    console.error("Login error:", error.message);
    showToast("Login failed: " + error.message, "error");
  }
}
// Google Sign In
async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    
    // Check if user exists in Firestore
    const userRef = db.collection("users").doc(user.uid);
    const doc = await userRef.get();
    
    if (!doc.exists) {
      // Create profile for new Google users
      const emailConsent = document.getElementById("email-consent") ? document.getElementById("email-consent").checked : false;
      await userRef.set({
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: "viewer",
        doorPass: false,
        createdAt: new Date(),
        uploadCount: 0,
        provider: "google",
        emailConsent: emailConsent
      });
      showToast("Welcome to Watchmen!", "success");
    } else {
      showToast("Welcome back!", "success");
    }
    
    closeAuthModal();
    updateNavigationUI();
    
    // Refresh page data
    if (typeof loadGallery === 'function') loadGallery();
    if (typeof checkAccess === 'function') checkAccess();
    
    return user;
  } catch (error) {
    console.error("Google Sign-In Error:", error.message);
    showToast("Google Sign-In failed", "error");
  }
}

// Logout user
async function logoutUser() {
  try {
    await auth.signOut();
    showToast("Logged out successfully", "success");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1000);
  } catch (error) {
    console.error("Logout error:", error.message);
  }
}

// Auth UI Functions
function toggleAuth() {
  const modal = document.getElementById("auth-modal");
  if (!modal) return;
  modal.style.display = modal.style.display === "none" ? "flex" : "none";
  isLoginMode = true;
  if (document.getElementById("auth-title")) document.getElementById("auth-title").innerText = "Login";
  if (document.getElementById("auth-submit-btn")) document.getElementById("auth-submit-btn").innerText = "Login";
}

function closeAuthModal() {
  const modal = document.getElementById("auth-modal");
  if (modal) modal.style.display = "none";
}

function toggleLoginSignup(event) {
  event.preventDefault();
  isLoginMode = !isLoginMode;
  const title = document.getElementById("auth-title");
  const btn = document.getElementById("auth-submit-btn");
  const link = event.target;
  
  if (isLoginMode) {
    if (title) title.innerText = "Login";
    if (btn) btn.innerText = "Login";
    link.innerText = "Don't have an account? Sign up";
  } else {
    if (title) title.innerText = "Sign Up";
    if (btn) btn.innerText = "Sign Up";
    link.innerText = "Already have an account? Login";
  }
}

async function submitAuth() {
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  const submitBtn = document.getElementById("auth-submit-btn");
  
  if (!email || !password) {
    showToast("Please fill in all fields", "warning");
    return;
  }
  
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add("btn-loading");
  }
  
  try {
    if (isLoginMode) {
      await loginUser(email, password);
    } else {
      await signUpUser(email, password);
    }
    
    if (auth.currentUser) {
      closeAuthModal();
      await updateAdminStatus();
      updateNavigationUI();
      // Reactive updates for specific pages
      if (typeof loadGallery === 'function') loadGallery();
      if (typeof checkAccess === 'function') checkAccess();
      if (window.isCurrentUserAdmin && typeof loadAllUsers === 'function') {
        loadAllUsers();
        loadStatistics();
      }
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove("btn-loading");
    }
    if (document.getElementById("auth-email")) document.getElementById("auth-email").value = "";
    if (document.getElementById("auth-password")) document.getElementById("auth-password").value = "";
  }
}

// Check if user has upload permission (door pass)
async function hasUploadPermission(uid) {
  try {
    const doc = await db.collection("users").doc(uid).get();
    return doc.exists && (doc.data().doorPass === true || doc.data().role === "admin");
  } catch (error) {
    console.error("Error checking permission:", error);
    return false;
  }
}

// Grant door pass to user (ADMIN ONLY)
async function grantDoorPass(targetUid) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return false;
    
    await db.collection("users").doc(targetUid).update({
      doorPass: true,
      grantedBy: currentUser.uid,
      grantedAt: new Date()
    });
    
    return true;
  } catch (error) {
    console.error("Error granting door pass:", error);
    showToast("Error granting access", "error");
    return false;
  }
}

// Revoke door pass (ADMIN ONLY)
async function revokeDoorPass(targetUid) {
  try {
    await db.collection("users").doc(targetUid).update({
      doorPass: false,
      revokedAt: new Date()
    });
    return true;
  } catch (error) {
    console.error("Error revoking door pass:", error);
    showToast("Error revoking access", "error");
    return false;
  }
}

// Verify/approve image (ADMIN ONLY)
async function verifyImage(imageId) {
  try {
    const user = auth.currentUser;
    if (!user) return false;
    
    await db.collection("images").doc(imageId).update({
      status: "approved",
      approvedBy: user.uid,
      approvedAt: new Date(),
      verifiedByAdmin: true
    });
    
    return true;
  } catch (error) {
    console.error("Error verifying image:", error);
    showToast("Error approving image", "error");
    return false;
  }
}

// Reject image (ADMIN ONLY)
async function rejectImage(imageId, reason = "") {
  try {
    const user = auth.currentUser;
    if (!user) return false;
    
    await db.collection("images").doc(imageId).update({
      status: "rejected",
      rejectedBy: user.uid,
      rejectedAt: new Date(),
      rejectionReason: reason
    });
    
    return true;
  } catch (error) {
    console.error("Error rejecting image:", error);
    showToast("Error rejecting image", "error");
    return false;
  }
}

// Centralized Navigation Update
async function updateNavigationUI() {
  const user = auth.currentUser;
  const els = {
    upload: document.getElementById("upload-link"),
    admin: document.getElementById("admin-link"),
    authToggle: document.getElementById("auth-toggle"),
    userStatus: document.getElementById("user-status")
  };
  
  if (user) {
    if (els.userStatus) els.userStatus.innerText = `👤 ${user.email}`;
    if (els.authToggle) {
      els.authToggle.innerText = "Logout";
      els.authToggle.onclick = logoutUser;
      els.authToggle.classList.add("logout-btn");
      els.authToggle.classList.remove("btn-primary");
    }
    
    // Check permissions
    const doc = await db.collection("users").doc(user.uid).get();
    const userData = doc.exists ? doc.data() : {};
    const isAdmin = userData.role === "admin";
    const hasDoorPass = userData.doorPass === true || isAdmin;
    
    window.isCurrentUserAdmin = isAdmin;
    
    if (els.upload) els.upload.style.display = hasDoorPass ? "inline-block" : "none";
    if (els.admin) els.admin.style.display = isAdmin ? "inline-block" : "none";
  } else {
    if (els.userStatus) els.userStatus.innerText = "Not logged in";
    if (els.authToggle) {
      els.authToggle.innerText = "Login";
      els.authToggle.onclick = toggleAuth;
      els.authToggle.classList.remove("logout-btn");
      els.authToggle.classList.add("btn-primary");
      els.authToggle.style.width = "auto";
      els.authToggle.style.padding = "0.5rem 1.2rem";
    }
    if (els.upload) els.upload.style.display = "none";
    if (els.admin) els.admin.style.display = "none";
  }
}

// Global modal background click listener
document.addEventListener("click", (e) => {
  const modal = document.getElementById("auth-modal");
  const authContainer = document.querySelector(".auth-container");
  if (modal && modal.style.display === "flex" && !authContainer.contains(e.target) && e.target.id !== "auth-toggle") {
    closeAuthModal();
  }
});

// Listen for auth changes globally
auth.onAuthStateChanged(user => {
  updateNavigationUI();
  if (typeof checkForPendingApprovals === 'function') checkForPendingApprovals();
  
  // Specific page initializations that depend on auth state
  if (typeof handleAdminInit === 'function') handleAdminInit();
  if (typeof checkAccess === 'function') checkAccess();
});



// GitHub Sign In
async function signInWithGitHub() {
  const provider = new firebase.auth.GithubAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    
    const userRef = db.collection("users").doc(user.uid);
    const doc = await userRef.get();
    
    if (!doc.exists) {
      const emailConsent = document.getElementById("email-consent") ? document.getElementById("email-consent").checked : false;
      await userRef.set({
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: "viewer",
        doorPass: false,
        createdAt: new Date(),
        uploadCount: 0,
        provider: "github",
        emailConsent: emailConsent
      });
      showToast("Welcome to Watchmen!", "success");
    } else {
      showToast("Welcome back!", "success");
    }
    
    closeAuthModal();
    updateNavigationUI();
    if (typeof loadGallery === 'function') loadGallery();
    if (typeof checkAccess === 'function') checkAccess();
    return user;
  } catch (error) {
    console.error("GitHub Sign-In Error:", error.message);
    showToast("GitHub Sign-In failed", "error");
  }
}
