# Watchman to Watchmen - Setup Guide

## Overview
**Watchman to Watchmen** is a Pinterest-style image sharing platform with a **door pass system** for selective upload permissions.

### Features:
✅ **Pinterest-style Gallery** - Browse and download images  
✅ **Door Pass System** - Only selected users can upload  
✅ **User Authentication** - Firebase Auth (Email/Password)  
✅ **Admin Panel** - Manage door passes and view statistics  
✅ **Mobile Responsive** - Works on web and mobile  
✅ **PWA Ready** - Installable web app  

---

## Setup Instructions

### Step 1: Configure Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use existing one
3. Go to **Project Settings** → Copy your config
4. Edit [js/firebase-config.js](js/firebase-config.js) and replace the config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### Step 2: Enable Firebase Services

In Firebase Console:

**Authentication:**
- Go to **Authentication** → **Sign-in method**
- Enable **Email/Password** authentication

**Firestore Database:**
- Go to **Firestore Database** → **Create Database**
- Choose **Start in test mode** (for development)
- Accept default location

**Cloud Storage:**
- Go to **Storage** → **Get Started**
- Accept default bucket

### Step 3: Set Firestore Rules

In **Firestore Database** → **Rules**, replace with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if request.auth.uid == userId || isAdmin(request.auth.uid);
      allow delete: if isAdmin(request.auth.uid);
    }

    // Images collection
    match /images/{imageId} {
      allow read: if true; // Public read
      allow create: if isAuthenticated() && hasUploadAccess(request.auth.uid);
      allow update: if isImageOwner(imageId, request.auth.uid) || isAdmin(request.auth.uid);
      allow delete: if isImageOwner(imageId, request.auth.uid) || isAdmin(request.auth.uid);
    }

    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin(uid) {
      return get(/databases/$(database)/documents/users/$(uid)).data.role == 'admin';
    }

    function hasUploadAccess(uid) {
      return get(/databases/$(database)/documents/users/$(uid)).data.doorPass == true || 
             get(/databases/$(database)/documents/users/$(uid)).data.role == 'admin';
    }

    function isImageOwner(imageId, uid) {
      return get(/databases/$(database)/documents/images/$(imageId)).data.uploadedByUid == uid;
    }
  }
}
```

### Step 4: Set Storage Rules

In **Cloud Storage** → **Rules**, replace with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true; // Public read
      allow write: if request.auth != null && request.auth.token.email_verified;
      allow delete: if isImageOwner() || isAdmin();
    }

    function isImageOwner() {
      return request.auth.uid == resource.metadata.userId;
    }

    function isAdmin() {
      return request.auth.token.admin == true;
    }
  }
}
```

### Step 5: Create Admin User

1. Sign up a user in the app at `http://localhost/watchman-to-watchmen/`
2. Go to **Firebase Console** → **Firestore** → **users** collection
3. Find your user document
4. Edit and add/change:
   - `role` → `"admin"` (instead of "viewer")
   - `doorPass` → `true`

### Step 6: Access the App

- **Gallery (Public):** `http://localhost/watchman-to-watchmen/`
- **Upload Page:** `http://localhost/watchman-to-watchmen/upload.html` (door pass required)
- **Admin Panel:** `http://localhost/watchman-to-watchmen/admin.html` (admin only)

---

## File Structure

```
watchman-to-watchmen/
├── index.html              # Main gallery page
├── upload.html             # Upload page (restricted)
├── admin.html              # Admin dashboard
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── css/
│   └── style.css           # Responsive styling
└── js/
    ├── firebase-config.js  # Firebase setup
    ├── auth.js             # Authentication & door pass
    ├── gallery.js          # Gallery functionality
    ├── upload.js           # Upload functionality
    └── admin.js            # Admin features
```

---

## User Roles & Permissions

### Viewer (Default)
- ✅ View all **approved** images only
- ✅ Download images
- ❌ Upload images
- ❌ Access admin panel

### Uploader (Door Pass)
- ✅ View all **approved** images
- ✅ Download images
- ✅ Upload unlimited images (need admin approval)
- ✅ Delete own images
- ✅ Track upload status (pending/approved/rejected)
- ❌ Access admin panel

### Admin
- ✅ All uploader permissions
- ✅ Auto-approve own uploads (instant gallery appearance)
- ✅ Grant/revoke door passes
- ✅ Approve/reject pending uploads
- ✅ Delete any image
- ✅ View statistics including pending uploads
- ✅ Access admin panel
- ✅ Special image formatting (golden border)

---

## Image Upload Workflow

### Regular Uploader Upload
1. User uploads image with title & description
2. Image status set to **"pending"**
3. Image appears grayed out in their upload list
4. Banner notification appears for admins
5. Admin reviews and approves/rejects
6. If approved → image appears in public gallery with ✓ badge
7. If rejected → image marked as rejected, hidden from public

### Admin Upload
1. Admin uploads image
2. Image auto-approved (status = **"approved"**)
3. Image instantly appears in public gallery
4. Image has special **golden border** styling
5. Image labeled as "👑 Admin Upload"
6. No formatting conflicts with other uploads

---

## Image Formatting & Styling

### Public Gallery Display
- **Approved Images** (Regular Uploader):
  - Standard white card
  - Regular box shadow
  - ✓ Verified badge (green)
  - Visible to all users

- **Admin Images**:
  - **Golden border (3px solid #f39c12)**
  - **Golden shadow glow effect**
  - 👑 Admin Upload badge (gold)
  - ✓ Verified badge (green)
  - Special hover effects
  - Visible to all users

### Upload Status Indicators

**Pending Images** (in uploader's list only):
- Grayed out (0.6 opacity)
- Dashed border (#95a5a6)
- ⏳ Pending Approval badge
- Not visible in public gallery

**Rejected Images** (in uploader's list only):
- More grayed out (0.4 opacity)
- Red border (#e74c3c)
- ✗ Rejected badge
- Not visible in public gallery

---

## Admin Features

### 1. Image Approval System
- **Pending Banner**: Admins see a notification banner when uploads need approval
- **Approval Modal**: Click "📋 Review Pending Approvals" to see all pending images
- **Approve Button**: Instantly approve and make images visible to public
- **Reject Button**: Reject with optional reason (image hidden from public)
- **Batch Review**: Review multiple pending images in one dashboard

### 2. Door Pass Management
- **Search Users**: Find users by email
- **Grant Access**: Click "Grant Access" to allow user uploads
- **Revoke Access**: Click "Revoke Access" to suspend user uploads
- **User Stats**: See upload count and join date for each user

### 3. Statistics Dashboard
- **Approved Images**: Total reviews-approved images in gallery
- **Pending Approval**: Count of images waiting for review
- **Total Users**: Total registered users
- **Uploaders**: Users with door pass access
- **Viewers**: Users without upload permission

### 4. Auto-Verify Own Uploads
- Admin uploads are **instantly approved**
- No waiting period for admin uploads
- Special golden styling (differentiate from regular uploads)
- Cannot be rejected by other admins

---

## Database Schema

### users collection
```javascript
{
  email: "user@example.com",
  role: "viewer" | "uploader" | "admin",
  doorPass: true/false,
  uploadCount: 0,
  createdAt: timestamp,
  grantedBy: "admin_uid",
  grantedAt: timestamp
}
```

### images collection
```javascript
{
  title: "Image Title",
  description: "Image Description",
  url: "https://storage.googleapis.com/...",
  uploadedBy: "user@example.com",
  uploadedByUid: "user_uid",
  isAdminUpload: true/false,
  createdAt: timestamp,
  fileSize: 1024000,
  fileName: "original_filename.jpg",
  status: "pending" | "approved" | "rejected",
  verifiedByAdmin: true/false,
  approvedBy: "admin_uid",
  approvedAt: timestamp,
  rejectedBy: "admin_uid",
  rejectedAt: timestamp,
  rejectionReason: "Optional reason"
}
```

---

## Features & Functionality

### Gallery Page (Public)
- **Pinterest-style masonry layout** - all approved images visible
- **Download images** - all users can download
- **Delete option** - only for image owners
- **Filter display** - only shows approved images
- **Admin notification** - banner shows pending approvals for admins

### Upload Page (Restricted)
- **Title + Description** - required metadata
- **Image upload** - Max 10MB file size
- **Progress tracking** - real-time upload progress
- **View your uploads** - see all your uploads with status
- **Status badges** - shows pending/approved/rejected status
- **Delete own** - remove your uploaded images
- **Auto-approval for admins** - admin uploads appear instantly

### Admin Panel
- **Door Pass Management**:
  - Search users by email
  - Grant/revoke upload access
  - View user upload count
  
- **Pending Approvals**:
  - See count of pending images
  - Review button to approve/reject
  - Batch approval interface
  
- **Statistics**:
  - Approved images count
  - Pending approvals count
  - Total users count
  - Uploaders (door pass) count
  - Viewers (no upload) count

---

## Troubleshooting

**Issue:** "Access Denied" on upload page
- **Solution:** Contact an admin to grant door pass

**Issue:** Images not loading
- **Solution:** Check Firebase Storage rules and CORS settings

**Issue:** Can't login/signup
- **Solution:** Verify Firebase Auth is enabled in console

**Issue:** Admin panel not showing
- **Solution:** Make sure your user role is set to "admin" in Firestore

---

## Security Notes

⚠️ **Development Mode:**
- Currently using test mode (open access)
- For production, set proper Firestore & Storage rules

⚠️ **Authentication:**
- Implement email verification for production
- Add password reset functionality
- Consider adding social login (Google, Facebook)

⚠️ **Content:**
- Add image moderation system
- Implement abuse reporting
- Set upload limits per user

---

## Next Steps (Optional Enhancements)

- [ ] Add email verification
- [ ] Implement search/filtering
- [ ] Add image categories/tags
- [ ] User profiles and avatars
- [ ] Image comments/reactions
- [ ] Batch download feature
- [ ] Share images on social media
- [ ] Image editing tools
- [ ] Dark mode theme

---

## Support

For issues or questions, check:
- Firebase Documentation: https://firebase.google.com/docs
- Service Worker Guide: https://developers.google.com/web/tools/workbox

---

**Happy sharing! 🎉**
