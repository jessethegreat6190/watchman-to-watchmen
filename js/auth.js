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
    console.error("Sign up error:", error.code, error.message);
    let errorMsg = "Sign up failed: " + error.message;
    if (error.code === 'auth/email-already-in-use') errorMsg = "This email is already registered.";
    else if (error.code === 'auth/weak-password') errorMsg = "Password should be at least 6 characters.";
    
    showToast(errorMsg, "error");
    return null;
  }
}

// Login user
async function loginUser(email, password) {
  try {
    const result = await auth.signInWithEmailAndPassword(email, password);
    showToast("Welcome back!", "success");
    return result.user;
  } catch (error) {
    console.error("Login error:", error.code, error.message);
    let errorMsg = "Login failed: " + error.message;
    if (error.code === 'auth/user-not-found') errorMsg = "No account found with this email.";
    else if (error.code === 'auth/wrong-password') errorMsg = "Incorrect password.";
    else if (error.code === 'auth/invalid-email') errorMsg = "Invalid email format.";
    
    showToast(errorMsg, "error");
    return null;
  }
}
// Google Sign In


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
    let user;
    if (isLoginMode) {
      user = await loginUser(email, password);
    } else {
      user = await signUpUser(email, password);
    }
    
    if (user) {
      closeAuthModal();
      // Auth state change listener will handle the rest (updateNavigationUI, etc)
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove("btn-loading");
    }
  }
}


// Check if user has upload permission (door pass)
async function hasUploadPermission(uid) {
  try {
    const doc = await db.collection("users").doc(uid).get();
    return doc.exists && doc.data().role === "admin";
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
  const user = auth.currentUser || null;
  const els = {
    boards: document.getElementById("boards-link"),
    upload: document.getElementById("upload-link"),
    admin: document.getElementById("admin-link"),
    authToggle: document.getElementById("auth-toggle"),
    userStatus: document.getElementById("user-status")
  };
  
  // Check actual admin status from database
  window.isCurrentUserAdmin = false;
  if (user) {
    try {
      const userDoc = await db.collection("users").doc(user.uid).get();
      if (userDoc.exists && userDoc.data().role === "admin") {
        window.isCurrentUserAdmin = true;
      }
    } catch (e) {
      console.log("Admin check error:", e);
    }
  }
  
  const displayUser = user || { email: "guest@watchmen.local", uid: "guest_uid", displayName: "Guest" };
  
  if (els.userStatus) {
    els.userStatus.innerHTML = `
      <div style="display: flex; align-items: center; gap: 1rem;">
        <a href="notifications.html" id="notification-bell" style="text-decoration: none; position: relative;">
          🔔 <span id="notification-count" style="display: none; position: absolute; top: -5px; right: -5px; background: #ef4444; color: #fff; font-size: 0.65rem; padding: 2px 5px; border-radius: 50%; font-weight: 800;">0</span>
        </a>
        <a href="profile.html?uid=${displayUser.uid}" style="color: #6366f1; text-decoration: none; font-weight: 600;">👤 ${displayUser.displayName || displayUser.email}</a>
      </div>
    `;
  }

  if (els.authToggle) {
    els.authToggle.innerText = user ? "Logout" : "Login";
    els.authToggle.onclick = user ? logoutUser : toggleAuth;
  }
  
  if (els.boards) els.boards.style.display = "inline-block";
  if (els.upload) els.upload.style.display = "inline-block";
  if (els.admin) els.admin.style.display = "inline-block";
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



// Unified Social Login Helper
async function handleSocialLogin(result, providerName) {
  const user = result.user;
  const userRef = db.collection("users").doc(user.uid);
  const doc = await userRef.get();
  
  if (!doc.exists) {
    const emailConsent = document.getElementById("email-consent") ? document.getElementById("email-consent").checked : false;
    await userRef.set({
      email: user.email,
      displayName: user.displayName || user.email.split('@')[0],
      photoURL: user.photoURL || "",
      role: "viewer",
      doorPass: false,
      createdAt: new Date(),
      uploadCount: 0,
      provider: providerName,
      emailConsent: emailConsent
    });
    showToast(`Welcome to Watchmen!`, "success");
  } else {
    showToast("Welcome back!", "success");
  }
  
  closeAuthModal();
  updateNavigationUI();
  if (typeof loadGallery === 'function') loadGallery();
  if (typeof checkAccess === 'function') checkAccess();
}

async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const result = await auth.signInWithPopup(provider);
    await handleSocialLogin(result, "google");
  } catch (error) {
    console.error("Google Error:", error);
    showToast("Google Login Failed", "error");
  }
}

async function signInWithGitHub() {
  const provider = new firebase.auth.GithubAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const result = await auth.signInWithPopup(provider);
    await handleSocialLogin(result, "github");
  } catch (error) {
    console.error("GitHub Error:", error);
    showToast("GitHub Login Failed", "error");
  }
}
