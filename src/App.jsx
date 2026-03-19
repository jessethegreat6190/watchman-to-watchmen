import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, GoogleAuthProvider, GithubAuthProvider,
  FacebookAuthProvider, signInWithPopup, deleteUser
} from "firebase/auth";
import {
  getFirestore, collection, addDoc, getDocs, doc, updateDoc,
  deleteDoc, arrayUnion, arrayRemove, getDoc, setDoc, increment, query, orderBy
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBgMcsNGiOWzJHCehxYbzcgf04w3WIpxKc",
  authDomain: "watchman-to-watchmen.firebaseapp.com",
  projectId: "watchman-to-watchmen",
  storageBucket: "watchman-to-watchmen.firebasestorage.app",
  messagingSenderId: "267490259843",
  appId: "1:267490259843:web:d2dd40bef6a1b46070fcb6",
  measurementId: "G-45LJ7N2TC8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();
const facebookProvider = new FacebookAuthProvider();

const ADMIN_PASS = "admin123";
const GUEST_DOWNLOAD_LIMIT = 3;
const SCRIPTURE = `"Son of man, I have made thee a watchman unto the house of Israel: therefore hear the word at my mouth, and give them warning from me. When I say unto the wicked, Thou shalt surely die; and thou dost not speak to warn the wicked from his wicked way, to save his life; the same wicked man shall die in his iniquity; but his blood will I require at thine hand."`;
const SCRIPTURE_REF = "— Ezekiel 33:7-8 (KJV)";
const CARD_HEIGHTS = [240, 300, 260, 340, 220, 320, 280, 360, 250, 310, 270, 330];
const toAscii = (str) => str.replace(/[^\x00-\x7F]/g, "").trim();

const SAMPLE_IMAGES = [
  { id: "s1", url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600", title: "Mountain Serenity", tags: ["nature", "mountain", "landscape"], downloads: 342, type: "photography" },
  { id: "s2", url: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=600", title: "Abstract Waves", tags: ["abstract", "art", "colorful"], downloads: 218, type: "artwork" },
  { id: "s3", url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600", title: "Forest Dawn", tags: ["nature", "forest", "fog"], downloads: 189, type: "photography" },
  { id: "s4", url: "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=600", title: "Desert Dunes", tags: ["desert", "landscape", "sand"], downloads: 421, type: "photography" },
  { id: "s5", url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600", title: "Starry Night", tags: ["night", "stars", "landscape"], downloads: 612, type: "photography" },
  { id: "s6", url: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=600", title: "Ocean Bliss", tags: ["ocean", "nature", "blue"], downloads: 534, type: "photography" },
];

// Navy blue admin theme
const NAVY = "#0f1e3d";
const NAVY_LIGHT = "#162a52";
const NAVY_BORDER = "#1e3a6e";
const NAVY_TEXT = "#c8d8f0";
const NAVY_MUTED = "#7a9cc4";
const GOLD = "#f0c040";

export default function App() {
  const [view, setView] = useState("gallery");
  const [adminTab, setAdminTab] = useState("upload");
  const [images, setImages] = useState(SAMPLE_IMAGES);
  const [loadingImages, setLoadingImages] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirm, setAuthConfirm] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [savedIds, setSavedIds] = useState([]);

  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPass, setAdminPass] = useState("");
  const [adminError, setAdminError] = useState("");

  // Admin users list
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [uploadForm, setUploadForm] = useState({ title: "", tags: "", type: "photography" });
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [iaKeys, setIaKeys] = useState(() => {
    try { return { accessKey: localStorage.getItem("ia_access_key") || "", secretKey: localStorage.getItem("ia_secret_key") || "" }; }
    catch { return { accessKey: "", secretKey: "" }; }
  });
  const [showKeysHelp, setShowKeysHelp] = useState(false);
  const [showKeysPanel, setShowKeysPanel] = useState(true);
  const fileInputRef = useRef(null);

  const [guestDownloads, setGuestDownloads] = useState(0);
  const [showAccountNudge, setShowAccountNudge] = useState(false);
  const [pendingDownload, setPendingDownload] = useState(null);
  const [shareImage, setShareImage] = useState(null);
  const [notification, setNotification] = useState(null);
  const [heroVisible, setHeroVisible] = useState(false);

  const notify = (msg, type = "success") => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 3500); };

  useEffect(() => { setTimeout(() => setHeroVisible(true), 100); }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    try {
      if (iaKeys.accessKey) localStorage.setItem("ia_access_key", iaKeys.accessKey);
      if (iaKeys.secretKey) localStorage.setItem("ia_secret_key", iaKeys.secretKey);
    } catch {}
  }, [iaKeys]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) setSavedIds(snap.data().saved || []);
          else await setDoc(doc(db, "users", u.uid), { saved: [], email: u.email, displayName: u.displayName || "", photoURL: u.photoURL || "", createdAt: new Date() });
        } catch (e) { console.error(e); }
      } else { setSavedIds([]); }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const q = query(collection(db, "images"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        if (!snap.empty) setImages([...snap.docs.map(d => ({ id: d.id, ...d.data() })), ...SAMPLE_IMAGES]);
      } catch (e) { console.warn("Firestore load failed", e); }
      finally { setLoadingImages(false); }
    };
    load();
  }, []);

  // Load users for admin
  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    finally { setLoadingUsers(false); }
  };

  useEffect(() => {
    if (isAdmin && adminTab === "users") loadUsers();
  }, [isAdmin, adminTab]);

  const filtered = images.filter(img =>
    !search || img.title?.toLowerCase().includes(search.toLowerCase()) ||
    (img.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const handleDownload = async (img) => {
    if (!user && guestDownloads >= GUEST_DOWNLOAD_LIMIT) { setPendingDownload(img); setShowAccountNudge(true); return; }
    const link = document.createElement("a");
    link.href = img.url; link.download = (img.title || "image") + ".jpg"; link.target = "_blank"; link.click();
    if (!user) setGuestDownloads(g => g + 1);
    if (!img.id?.startsWith("s")) { try { await updateDoc(doc(db, "images", img.id), { downloads: increment(1) }); } catch {} }
    notify(`Downloading "${img.title}"`);
  };

  const handleSave = async (img) => {
    if (!user) { setShowAuth(true); return; }
    const userRef = doc(db, "users", user.uid);
    if (savedIds.includes(img.id)) {
      setSavedIds(p => p.filter(id => id !== img.id));
      try { await updateDoc(userRef, { saved: arrayRemove(img.id) }); } catch {}
      notify("Removed from saved");
    } else {
      setSavedIds(p => [...p, img.id]);
      try { await updateDoc(userRef, { saved: arrayUnion(img.id) }); } catch {}
      notify("Saved to your collection");
    }
  };

  const handleShare = (platform, img) => {
    const url = encodeURIComponent(img.url);
    const text = encodeURIComponent(`Check out "${img.title}" on Watchman Gallery`);
    if (platform === "copy") { navigator.clipboard.writeText(img.url).then(() => notify("Link copied!")); }
    else if (platform === "facebook") window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank", "width=600,height=400");
    else if (platform === "twitter") window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank", "width=600,height=400");
    else if (platform === "whatsapp") window.open(`https://wa.me/?text=${text}%20${url}`, "_blank");
    setShareImage(null);
  };

  const handleSocialLogin = async (provider) => {
    setAuthError(""); setAuthBusy(true);
    try {
      const result = await signInWithPopup(auth, provider);
      const u = result.user;
      const snap = await getDoc(doc(db, "users", u.uid));
      if (!snap.exists()) await setDoc(doc(db, "users", u.uid), { saved: [], email: u.email, displayName: u.displayName || "", photoURL: u.photoURL || "", provider: u.providerData[0]?.providerId, createdAt: new Date() });
      setShowAuth(false); setGuestDownloads(0);
      notify(`Welcome, ${u.displayName || u.email}!`);
      if (pendingDownload) { setTimeout(() => handleDownload(pendingDownload), 400); setPendingDownload(null); }
    } catch (err) {
      const msgs = { "auth/popup-closed-by-user": "Sign-in was cancelled.", "auth/account-exists-with-different-credential": "An account already exists with this email.", "auth/popup-blocked": "Popup was blocked. Please allow popups for this site." };
      setAuthError(msgs[err.code] || err.message);
    } finally { setAuthBusy(false); }
  };

  const handleAuth = async () => {
    setAuthError("");
    if (!authEmail || !authPassword) { setAuthError("Please fill in all fields."); return; }
    if (authMode === "signup" && authPassword !== authConfirm) { setAuthError("Passwords do not match."); return; }
    if (authPassword.length < 6) { setAuthError("Password must be at least 6 characters."); return; }
    setAuthBusy(true);
    try {
      if (authMode === "signup") { await createUserWithEmailAndPassword(auth, authEmail, authPassword); notify("Account created! Welcome."); }
      else { await signInWithEmailAndPassword(auth, authEmail, authPassword); notify("Welcome back!"); }
      setShowAuth(false); setAuthEmail(""); setAuthPassword(""); setAuthConfirm(""); setGuestDownloads(0);
      if (pendingDownload) { setTimeout(() => handleDownload(pendingDownload), 400); setPendingDownload(null); }
    } catch (err) {
      const msgs = { "auth/user-not-found": "No account with this email.", "auth/wrong-password": "Incorrect password.", "auth/email-already-in-use": "Email already in use.", "auth/invalid-email": "Invalid email.", "auth/too-many-requests": "Too many attempts.", "auth/invalid-credential": "Email or password incorrect." };
      setAuthError(msgs[err.code] || err.message);
    } finally { setAuthBusy(false); }
  };

  const handleSignOut = async () => { await signOut(auth); setSavedIds([]); setView("gallery"); notify("Signed out."); };

  const handleAdminLogin = () => {
    if (adminPass === ADMIN_PASS) { setIsAdmin(true); setShowAdminLogin(false); setAdminError(""); setAdminPass(""); setView("admin"); notify("Welcome, Admin!"); }
    else setAdminError("Incorrect password.");
  };

  const handleDeleteUser = async (u) => {
    try { await deleteDoc(doc(db, "users", u.id)); setUsers(prev => prev.filter(x => x.id !== u.id)); notify(`User ${u.email} removed from records.`); }
    catch (e) { notify("Could not delete user record.", "error"); }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (!file.type.startsWith("image/")) { setUploadError("Please select an image file."); return; }
    if (file.size > 200 * 1024 * 1024) { setUploadError("File must be under 200MB."); return; }
    setUploadFile(file); setUploadError("");
    const reader = new FileReader();
    reader.onload = (ev) => setUploadPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!uploadFile) { setUploadError("Please select an image file."); return; }
    if (!uploadForm.title.trim()) { setUploadError("Please enter a title."); return; }
    if (!iaKeys.accessKey.trim() || !iaKeys.secretKey.trim()) { setUploadError("Please enter your Internet Archive S3 keys above."); setShowKeysPanel(true); return; }
    setUploading(true); setUploadProgress(0); setUploadError("");
    try {
      const safeTitle = toAscii(uploadForm.title.trim());
      const identifier = "watchman-" + safeTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now();
      const filename = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const tags = uploadForm.tags.split(",").map(t => toAscii(t.trim().toLowerCase())).filter(Boolean);
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", `https://s3.us.archive.org/${identifier}/${filename}`, true);
      xhr.setRequestHeader("Authorization", `LOW ${toAscii(iaKeys.accessKey)}:${toAscii(iaKeys.secretKey)}`);
      xhr.setRequestHeader("x-archive-auto-make-bucket", "1");
      xhr.setRequestHeader("x-archive-meta-title", safeTitle);
      xhr.setRequestHeader("x-archive-meta-mediatype", "image");
      xhr.setRequestHeader("x-archive-meta-subject", toAscii(uploadForm.tags));
      xhr.setRequestHeader("x-archive-meta-description", `Uploaded via Melania - ${uploadForm.type}`);
      xhr.setRequestHeader("Content-Type", uploadFile.type);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100)); };
      await new Promise((resolve, reject) => {
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}). Check your IA keys.`));
        xhr.onerror = () => reject(new Error("Network error. Check connection and IA keys."));
        xhr.send(uploadFile);
      });
      const publicUrl = `https://archive.org/download/${identifier}/${filename}`;
      const docRef = await addDoc(collection(db, "images"), { url: publicUrl, title: uploadForm.title.trim(), tags, type: uploadForm.type, downloads: 0, iaIdentifier: identifier, createdAt: new Date() });
      setImages(prev => [{ id: docRef.id, url: publicUrl, title: uploadForm.title.trim(), tags, type: uploadForm.type, downloads: 0 }, ...prev]);
      setUploadForm({ title: "", tags: "", type: "photography" }); setUploadFile(null); setUploadPreview(null); setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
      notify("Image uploaded & live on Melania!");
    } catch (err) { setUploadError(err.message); }
    finally { setUploading(false); }
  };

  const handleDelete = async (img) => {
    if (!img.id?.startsWith("s")) { try { await deleteDoc(doc(db, "images", img.id)); } catch {} }
    setImages(prev => prev.filter(i => i.id !== img.id));
    if (selectedImage?.id === img.id) setSelectedImage(null);
    notify("Image deleted.");
  };

  const savedImages = images.filter(i => savedIds.includes(i.id));
  const inp = { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #d0d0d0", background: "#fff", color: "#1a1a1a", fontFamily: "'DM Sans', sans-serif", fontSize: 14, outline: "none" };
  const navyInp = { width: "100%", padding: "10px 14px", borderRadius: 8, border: `1px solid ${NAVY_BORDER}`, background: NAVY_LIGHT, color: NAVY_TEXT, fontFamily: "'DM Sans', sans-serif", fontSize: 14, outline: "none" };

  const ShareButtons = ({ img }) => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {[
        { key: "facebook", label: "Facebook", bg: "#1877f2", color: "#fff" },
        { key: "twitter", label: "X / Twitter", bg: "#000", color: "#fff" },
        { key: "whatsapp", label: "WhatsApp", bg: "#25d366", color: "#fff" },
        { key: "copy", label: "Copy link", bg: "#f0f0f0", color: "#1a1a1a" },
      ].map(s => (
        <button key={s.key} onClick={() => handleShare(s.key, img)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 13, fontFamily: "DM Sans", fontWeight: 500, background: s.bg, color: s.color, transition: "all 0.2s" }}
          onMouseOver={e => e.currentTarget.style.opacity = "0.82"} onMouseOut={e => e.currentTarget.style.opacity = "1"}>
          {s.label}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#fafaf8" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:wght@300;400;500&display=swap');
        @font-face { font-family: 'Gondens'; src: url('/fonts/gondens-demo.regular.otf') format('opentype'); font-weight: normal; font-style: normal; font-display: swap; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .serif { font-family: 'Cormorant Garamond', Georgia, serif; }
        .gondens { font-family: 'Gondens', 'Cormorant Garamond', Georgia, serif; }

        /* NAV */
        .nav-wrap { position: fixed; top: 0; left: 0; right: 0; z-index: 50; transition: all 0.35s ease; }
        .nav-scrolled { background: rgba(5,5,5,0.95); backdrop-filter: blur(16px); box-shadow: 0 1px 30px rgba(0,0,0,0.3); }
        .nav-top { background: #000; }
        .nav-inner { max-width: 1300px; margin: 0 auto; padding: 0 16px; height: 66px; display: flex; align-items: center; justify-content: space-between; }
        .nl { background: none; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; letter-spacing: 0.03em; padding: 6px 10px; border-radius: 6px; transition: all 0.2s; color: rgba(255,255,255,0.55); }
        .nl:hover { color: #fff; background: rgba(255,255,255,0.07); }
        .nl.on { color: #fff; background: rgba(255,255,255,0.1); }
        /* Hide text nav links on mobile, show icon-only admin btn */
        .nl-hide-mobile { display: inline-flex; }
        .admin-icon-btn { display: none; }
        @media (max-width: 640px) {
          .nl-hide-mobile { display: none; }
          .admin-icon-btn { display: flex !important; }
          .nav-inner { padding: 0 12px; }
          .logged-badge { display: none !important; }
        }

        /* HERO ANIMATIONS */
        .hero-enter { opacity: 0; transform: translateY(24px); transition: all 0.8s cubic-bezier(0.22,1,0.36,1); }
        .hero-enter.visible { opacity: 1; transform: translateY(0); }
        .hero-enter.d1 { transition-delay: 0.1s; }
        .hero-enter.d2 { transition-delay: 0.25s; }
        .hero-enter.d3 { transition-delay: 0.4s; }
        .hero-enter.d4 { transition-delay: 0.55s; }

        /* SCRIPTURE GLOW */
        @keyframes scriptureGlow { 0%,100%{box-shadow:0 0 0 rgba(240,192,64,0)} 50%{box-shadow:0 4px 32px rgba(240,192,64,0.12)} }
        .scripture-block { animation: scriptureGlow 4s ease infinite; }

        /* CARDS */
        .card-wrap { break-inside: avoid; margin-bottom: 18px; position: relative; border-radius: 14px; overflow: hidden; cursor: pointer; animation: fadeUp 0.6s ease both; }
        .card-wrap img { width: 100%; display: block; object-fit: cover; transition: transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94); }
        .card-wrap:hover img { transform: scale(1.06); }
        .card-ov { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.15) 50%, transparent 100%); opacity: 0; transition: opacity 0.35s; display: flex; flex-direction: column; justify-content: flex-end; padding: 14px; }
        .card-wrap:hover .card-ov { opacity: 1; }
        .ca { display: flex; gap: 6px; }
        .ca-btn { padding: 6px 11px; border-radius: 8px; border: none; cursor: pointer; font-size: 11px; font-family: 'DM Sans', sans-serif; font-weight: 500; display: flex; align-items: center; gap: 4px; transition: transform 0.15s, opacity 0.15s; }
        .ca-btn:hover { transform: translateY(-2px); }
        .masonry { columns: 3; column-gap: 18px; }
        @media (max-width: 900px) { .masonry { columns: 2; } }
        @media (max-width: 560px) { .masonry { columns: 1; } }

        /* BUTTONS */
        .btn-blk { background: #1a1a1a; color: #fff; border: none; border-radius: 9px; padding: 11px 24px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: background 0.2s, transform 0.15s; }
        .btn-blk:hover { background: #2d2d2d; transform: translateY(-1px); }
        .btn-wht { background: #fff; color: #1a1a1a; border: 1px solid #ddd; border-radius: 9px; padding: 11px 24px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .btn-wht:hover { background: #f5f5f5; }
        .btn-red { background: #e24b4a; color: #fff; border: none; border-radius: 9px; padding: 9px 18px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: background 0.2s; }
        .btn-red:hover { background: #c03030; }
        .btn-navy { background: ${NAVY}; color: ${NAVY_TEXT}; border: 1px solid ${NAVY_BORDER}; border-radius: 9px; padding: 11px 24px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .btn-navy:hover { background: ${NAVY_LIGHT}; }
        .btn-gold { background: ${GOLD}; color: #000; border: none; border-radius: 9px; padding: 11px 24px; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .btn-gold:hover { background: #e8b830; transform: translateY(-1px); }

        /* CLOSE BTN */
        .close-btn { width: 34px; height: 34px; border-radius: 50%; background: #f0f0f0; border: none; cursor: pointer; font-size: 15px; color: #1a1a1a; display: flex; align-items: center; justify-content: center; font-weight: 700; transition: background 0.2s; flex-shrink: 0; }
        .close-btn:hover { background: #e0e0e0; }

        /* OVERLAY */
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.82); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 20px; }

        /* SEARCH */
        .search-bar { display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid #e8e8e8; border-radius: 999px; padding: 10px 20px; max-width: 480px; width: 100%; box-shadow: 0 2px 16px rgba(0,0,0,0.06); transition: box-shadow 0.2s; }
        .search-bar:focus-within { box-shadow: 0 4px 24px rgba(0,0,0,0.1); }
        .search-bar input { border: none; background: transparent; outline: none; font-size: 14px; color: #1a1a1a; font-family: 'DM Sans', sans-serif; width: 100%; }

        /* NOTIF */
        .notif { position: fixed; bottom: 28px; right: 28px; padding: 13px 22px; border-radius: 12px; font-size: 13px; font-family: 'DM Sans', sans-serif; z-index: 999; animation: slideUp 0.3s ease; max-width: 320px; font-weight: 500; box-shadow: 0 4px 24px rgba(0,0,0,0.18); }
        .notif-success { background: #1a1a1a; color: #fff; }
        .notif-error { background: #e24b4a; color: #fff; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }

        /* SOCIAL LOGIN BUTTONS */
        .social-btn { width: 100%; padding: 11px; border-radius: 9px; border: 1px solid #e0e0e0; background: #fff; color: #1a1a1a; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.2s; }
        .social-btn:hover { background: #f8f8f8; border-color: #ccc; transform: translateY(-1px); }

        /* ADMIN NAV TABS */
        .admin-tab { padding: 8px 20px; border-radius: 8px; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; transition: all 0.2s; background: transparent; color: ${NAVY_MUTED}; }
        .admin-tab.on { background: ${GOLD}; color: #000; }
        .admin-tab:hover:not(.on) { background: ${NAVY_LIGHT}; color: ${NAVY_TEXT}; }

        /* ADMIN SECTIONS */
        .admin-sec { background: ${NAVY_LIGHT}; border: 1px solid ${NAVY_BORDER}; border-radius: 18px; padding: 28px; margin-bottom: 24px; }
        .admin-label { font-size: 12px; color: ${NAVY_MUTED}; display: block; margin-bottom: 7px; font-family: 'DM Sans', sans-serif; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; }
        .drop-zone { border: 2px dashed ${NAVY_BORDER}; border-radius: 14px; padding: 40px 24px; text-align: center; cursor: pointer; transition: all 0.2s; background: ${NAVY}; }
        .drop-zone:hover { border-color: ${GOLD}; }
        .progress-bar { height: 5px; background: ${NAVY}; border-radius: 999px; overflow: hidden; }
        .progress-fill { height: 100%; background: ${GOLD}; border-radius: 999px; transition: width 0.3s ease; }
        .img-row { display: flex; align-items: center; gap: 14px; background: ${NAVY}; border: 1px solid ${NAVY_BORDER}; border-radius: 12px; padding: 11px 16px; transition: box-shadow 0.2s; }
        .img-row:hover { box-shadow: 0 2px 16px rgba(0,0,0,0.3); }
        .user-row { display: flex; align-items: center; gap: 14px; background: ${NAVY}; border: 1px solid ${NAVY_BORDER}; border-radius: 12px; padding: 14px 16px; transition: all 0.2s; }
        .user-row:hover { box-shadow: 0 2px 16px rgba(0,0,0,0.3); }
        .pill { display: inline-block; padding: 3px 11px; border-radius: 999px; font-size: 11px; background: ${NAVY}; color: ${NAVY_MUTED}; font-family: 'DM Sans', sans-serif; border: 1px solid ${NAVY_BORDER}; }
        .err { margin-top: 12px; padding: 11px 15px; background: rgba(226,75,74,0.15); border: 1px solid rgba(226,75,74,0.4); border-radius: 9px; font-size: 13px; color: #ff8080; font-family: 'DM Sans', sans-serif; }
        .detail-modal { background: #fff; border-radius: 22px; overflow: hidden; max-width: 920px; width: 100%; display: flex; max-height: 90vh; }
        @media (max-width: 640px) { .detail-modal { flex-direction: column; } .detail-modal > img { width: 100% !important; height: 220px !important; } }

        /* STAT CARDS */
        .stat-card { background: ${NAVY}; border: 1px solid ${NAVY_BORDER}; border-radius: 14px; padding: 20px 24px; text-align: center; }

        /* LOGGED IN BADGE */
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        .live-dot { width:8px;height:8px;border-radius:50%;background:#22c55e;animation:pulse 2s infinite;flex-shrink:0; }
      `}</style>

      {/* NAV */}
      <nav className={`nav-wrap ${scrolled ? "nav-scrolled" : "nav-top"}`}>
        <div className="nav-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ border: "2px solid #fff", padding: "3px 14px", cursor: "pointer", borderRadius: 2 }} onClick={() => setView("gallery")}>
              <span style={{ fontFamily: "'Gondens', 'Cormorant Garamond', Georgia, serif", fontSize: 20, fontWeight: 400, color: "#fff", letterSpacing: "0.08em" }}>Melania</span>
            </div>
            <span style={{ color: "rgba(255,255,255,0.2)", display: "none" }} className="nl-hide-mobile">|</span>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "DM Sans" }} className="nl-hide-mobile">To Watchmen</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button className={`nl nl-hide-mobile ${view === "gallery" ? "on" : ""}`} onClick={() => setView("gallery")}>Explore</button>
            {user && <button className={`nl nl-hide-mobile ${view === "saved" ? "on" : ""}`} onClick={() => setView("saved")}>Saved {savedIds.length > 0 && `(${savedIds.length})`}</button>}
            {isAdmin && <button className={`nl nl-hide-mobile ${view === "admin" ? "on" : ""}`} onClick={() => setView("admin")}>Admin</button>}
            {!user && guestDownloads > 0 && (
              <span className="nl-hide-mobile" style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", padding: "3px 10px", background: "rgba(255,255,255,0.07)", borderRadius: 999 }}>
                {GUEST_DOWNLOAD_LIMIT - guestDownloads} left
              </span>
            )}
            {/* Logged in indicator — hidden on mobile */}
            {user && (
              <div className="logged-badge" style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "rgba(34,197,94,0.12)", borderRadius: 999, border: "1px solid rgba(34,197,94,0.25)" }}>
                <div className="live-dot" />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: "DM Sans" }}>
                  {user.displayName || user.email?.split("@")[0]}
                </span>
              </div>
            )}
            {/* Desktop admin link */}
            {!isAdmin && <button className="nl nl-hide-mobile" style={{ color: "rgba(255,255,255,0.25)" }} onClick={() => setShowAdminLogin(true)}>Admin</button>}

            {/* Mobile admin icon button */}
            <button className="admin-icon-btn" title="Admin panel"
              style={{ alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 8, background: isAdmin ? "rgba(240,192,64,0.2)" : "rgba(255,255,255,0.08)", border: isAdmin ? "1px solid rgba(240,192,64,0.5)" : "1px solid rgba(255,255,255,0.15)", cursor: "pointer", transition: "all 0.2s" }}
              onClick={() => isAdmin ? setView("admin") : setShowAdminLogin(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isAdmin ? "#f0c040" : "rgba(255,255,255,0.6)"} strokeWidth="2">
                <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                <circle cx="19" cy="8" r="2" fill={isAdmin ? "#f0c040" : "rgba(255,255,255,0.4)"} stroke="none"/>
              </svg>
            </button>

            {/* Mobile explore / saved icons */}
            <button className="admin-icon-btn" style={{ alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer" }} onClick={() => setView("gallery")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </button>

            {user
              ? <button style={{ marginLeft: 4, padding: "7px 14px", border: "1px solid rgba(255,255,255,0.18)", color: "#fff", background: "transparent", borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans", fontSize: 12 }} onClick={handleSignOut}>Sign out</button>
              : <button style={{ marginLeft: 4, padding: "7px 14px", background: "#fff", color: "#000", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans", fontSize: 13, fontWeight: 600 }} onClick={() => setShowAuth(true)}>Sign in</button>
            }
          </div>
        </div>
      </nav>

      {/* GALLERY */}
      {view === "gallery" && (
        <div>
          <div style={{ padding: "116px 28px 52px", maxWidth: 1300, margin: "0 auto" }}>
            <div className={`hero-enter d1 ${heroVisible ? "visible" : ""}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#000", color: "#fff", padding: "5px 18px 5px 5px", borderRadius: 999, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "DM Sans", fontWeight: 500, marginBottom: 24 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="#000"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </div>
              Melania — Watchman to Watchmen
            </div>

            <h1 className={`hero-enter d2 ${heroVisible ? "visible" : ""}`} style={{ fontFamily: "'Gondens', 'Cormorant Garamond', Georgia, serif", fontSize: "clamp(42px, 7vw, 96px)", fontWeight: 400, letterSpacing: "-1px", lineHeight: 1.0, marginBottom: 16, color: "#0a0a0a" }}>
              Melania
              <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: "italic", fontSize: "clamp(22px, 3vw, 42px)", color: "#555", display: "block", fontWeight: 400, marginTop: 4, letterSpacing: "0" }}>Watcher On The Wall · Narrow Pather</span>
            </h1>

            <p className={`hero-enter d3 ${heroVisible ? "visible" : ""}`} style={{ fontSize: 16, color: "#666", marginBottom: 28, maxWidth: 560, lineHeight: 1.75, fontFamily: "DM Sans" }}>
              Midnight Crier — Curated photography & artwork freely shared for the body of Christ.
            </p>

            {/* Scripture block */}
            <div className={`scripture-block hero-enter d4 ${heroVisible ? "visible" : ""}`} style={{ borderLeft: `4px solid ${GOLD}`, paddingLeft: 24, marginBottom: 44, maxWidth: 680, background: "linear-gradient(135deg, rgba(240,192,64,0.06) 0%, transparent 100%)", padding: "24px 24px 24px 28px", borderRadius: "0 12px 12px 0" }}>
              <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(20px, 2.5vw, 26px)", fontStyle: "italic", color: "#2a2a2a", lineHeight: 1.9, marginBottom: 12 }}>
                {SCRIPTURE}
              </p>
              <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 16, color: "#888", fontWeight: 500 }}>{SCRIPTURE_REF}</p>
            </div>

            <div className={`hero-enter d4 ${heroVisible ? "visible" : ""}`} style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div className="search-bar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input placeholder="Search visuals, tags…" value={search} onChange={e => setSearch(e.target.value)} />
                {search && <button style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: 14 }} onClick={() => setSearch("")}>✕</button>}
              </div>
              <span style={{ fontSize: 13, color: "#aaa", fontFamily: "DM Sans" }}>{filtered.length} visuals</span>
              {user && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div className="live-dot" />
                  <span style={{ fontSize: 13, color: "#555", fontFamily: "DM Sans" }}>Signed in as {user.displayName || user.email}</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: "0 28px 80px", maxWidth: 1300, margin: "0 auto" }}>
            {loadingImages
              ? <div style={{ textAlign: "center", padding: "80px 0", color: "#aaa", fontFamily: "DM Sans" }}>Loading gallery…</div>
              : filtered.length === 0
                ? <div style={{ textAlign: "center", padding: "80px 0", color: "#aaa", fontFamily: "DM Sans" }}>No visuals match your search.</div>
                : <div className="masonry">
                    {filtered.map((img, idx) => {
                      const h = img.displayHeight || CARD_HEIGHTS[idx % CARD_HEIGHTS.length];
                      return (
                        <div key={img.id} className="card-wrap" style={{ animationDelay: `${(idx % 6) * 0.07}s` }}>
                          <img src={img.url} alt={img.title} style={{ height: h }} onClick={() => setSelectedImage(img)} loading="lazy"
                            onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
                            onLoad={e => { e.target.style.display = "block"; e.target.nextSibling.style.display = "none"; }}
                          />
                          <div onClick={() => setSelectedImage(img)} style={{ display: "none", height: h, background: "#1a1a1a", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, cursor: "pointer" }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "DM Sans", textAlign: "center", padding: "0 12px" }}>{img.title}</p>
                            <p style={{ color: "rgba(255,255,255,0.28)", fontSize: 11, fontFamily: "DM Sans" }}>Processing — check back soon</p>
                          </div>
                          <div className="card-ov" onClick={() => setSelectedImage(img)}>
                            <p style={{ color: "#fff", fontSize: 13, fontWeight: 500, marginBottom: 9, fontFamily: "DM Sans", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>{img.title}</p>
                            <div className="ca" onClick={e => e.stopPropagation()}>
                              <button className="ca-btn" style={{ background: "rgba(255,255,255,0.95)", color: "#1a1a1a", flex: 1 }} onClick={() => handleDownload(img)}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                Download
                              </button>
                              <button className="ca-btn" style={{ background: savedIds.includes(img.id) ? "#1a1a1a" : "rgba(255,255,255,0.95)", color: savedIds.includes(img.id) ? "#fff" : "#1a1a1a" }} onClick={() => handleSave(img)}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill={savedIds.includes(img.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                              </button>
                              <button className="ca-btn" style={{ background: "rgba(255,255,255,0.95)", color: "#1a1a1a" }} onClick={() => setShareImage(img)}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                              </button>
                              {isAdmin && (
                                <button className="ca-btn" style={{ background: "#e24b4a", color: "#fff" }} onClick={() => handleDelete(img)}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
            }
          </div>
        </div>
      )}

      {/* SAVED */}
      {view === "saved" && (
        <div style={{ padding: "100px 28px 80px", maxWidth: 1300, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 600, marginBottom: 8 }}>Your saved visuals</h2>
          <p style={{ fontSize: 14, color: "#aaa", marginBottom: 32, fontFamily: "DM Sans" }}>{savedImages.length} saved</p>
          {savedImages.length === 0
            ? <div style={{ textAlign: "center", padding: "80px 0", color: "#bbb", fontFamily: "DM Sans" }}>Nothing saved yet.</div>
            : <div className="masonry">
                {savedImages.map((img, idx) => (
                  <div key={img.id} className="card-wrap">
                    <img src={img.url} alt={img.title} style={{ height: CARD_HEIGHTS[idx % CARD_HEIGHTS.length] }} onClick={() => setSelectedImage(img)} loading="lazy" />
                    <div className="card-ov">
                      <div className="ca" onClick={e => e.stopPropagation()}>
                        <button className="ca-btn" style={{ background: "rgba(255,255,255,0.95)", color: "#1a1a1a", flex: 1 }} onClick={() => handleDownload(img)}>Download</button>
                        <button className="ca-btn" style={{ background: "#1a1a1a", color: "#fff" }} onClick={() => handleSave(img)}>Remove</button>
                        <button className="ca-btn" style={{ background: "rgba(255,255,255,0.95)", color: "#1a1a1a" }} onClick={() => setShareImage(img)}>Share</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      )}

      {/* ── ADMIN ── */}
      {view === "admin" && isAdmin && (
        <div style={{ minHeight: "100vh", background: NAVY, paddingTop: 66 }}>
          {/* Admin Header */}
          <div style={{ background: NAVY_LIGHT, borderBottom: `1px solid ${NAVY_BORDER}`, padding: "24px 28px" }}>
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 600, color: "#fff", marginBottom: 4 }}>Admin Panel</h2>
                  <p style={{ fontSize: 13, color: NAVY_MUTED, fontFamily: "DM Sans" }}>Melania — Watchman to Watchmen Content Management</p>
                </div>
                {/* Stat cards */}
                <div style={{ display: "flex", gap: 12 }}>
                  <div className="stat-card">
                    <p style={{ fontSize: 28, fontWeight: 700, color: GOLD, fontFamily: "DM Sans" }}>{images.filter(i => !i.id?.startsWith("s")).length}</p>
                    <p style={{ fontSize: 11, color: NAVY_MUTED, fontFamily: "DM Sans", textTransform: "uppercase", letterSpacing: "0.08em" }}>Images</p>
                  </div>
                  <div className="stat-card">
                    <p style={{ fontSize: 28, fontWeight: 700, color: GOLD, fontFamily: "DM Sans" }}>{users.length}</p>
                    <p style={{ fontSize: 11, color: NAVY_MUTED, fontFamily: "DM Sans", textTransform: "uppercase", letterSpacing: "0.08em" }}>Users</p>
                  </div>
                  <div className="stat-card">
                    <p style={{ fontSize: 28, fontWeight: 700, color: GOLD, fontFamily: "DM Sans" }}>{images.reduce((a, b) => a + (b.downloads || 0), 0)}</p>
                    <p style={{ fontSize: 11, color: NAVY_MUTED, fontFamily: "DM Sans", textTransform: "uppercase", letterSpacing: "0.08em" }}>Downloads</p>
                  </div>
                </div>
              </div>
              {/* Tabs */}
              <div style={{ display: "flex", gap: 8 }}>
                {[["upload", "Upload"], ["images", "All Images"], ["users", "Users"]].map(([key, label]) => (
                  <button key={key} className={`admin-tab ${adminTab === key ? "on" : ""}`} onClick={() => setAdminTab(key)}>{label}</button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 28px 80px" }}>

            {/* UPLOAD TAB */}
            {adminTab === "upload" && (
              <div>
                {/* IA Keys */}
                <div className="admin-sec">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setShowKeysPanel(p => !p)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: iaKeys.accessKey ? "#22c55e" : "#f59e0b", flexShrink: 0 }} />
                      <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 500, color: NAVY_TEXT }}>
                        Internet Archive — {iaKeys.accessKey ? "keys saved ✓" : "keys not set"}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#60a5fa", textDecoration: "underline", fontFamily: "DM Sans" }}
                        onClick={e => { e.stopPropagation(); setShowKeysHelp(h => !h); }}>
                        How to get keys?
                      </button>
                      <span style={{ fontSize: 12, color: NAVY_MUTED, fontFamily: "DM Sans" }}>{showKeysPanel ? "▲" : "▼"}</span>
                    </div>
                  </div>
                  {showKeysPanel && (
                    <div style={{ marginTop: 20 }}>
                      {showKeysHelp && (
                        <div style={{ background: NAVY, borderRadius: 10, padding: 16, marginBottom: 18, fontSize: 13, lineHeight: 1.9, color: NAVY_MUTED, fontFamily: "DM Sans" }}>
                          1. Go to <strong style={{ color: NAVY_TEXT }}>archive.org</strong> → create a free account<br />
                          2. Visit <strong style={{ color: NAVY_TEXT }}>archive.org/account/s3.php</strong><br />
                          3. Click <strong style={{ color: NAVY_TEXT }}>"Generate new keys"</strong><br />
                          4. Paste below — saved automatically, only do this once.
                        </div>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <div>
                          <label className="admin-label">Access key</label>
                          <input style={navyInp} placeholder="Your IA access key" type="text" value={iaKeys.accessKey} onChange={e => setIaKeys(k => ({ ...k, accessKey: e.target.value }))} />
                        </div>
                        <div>
                          <label className="admin-label">Secret key</label>
                          <input style={navyInp} placeholder="Your IA secret key" type="password" value={iaKeys.secretKey} onChange={e => setIaKeys(k => ({ ...k, secretKey: e.target.value }))} />
                        </div>
                      </div>
                      <button className="btn-gold" style={{ marginTop: 14, fontSize: 13 }} onClick={() => { setShowKeysPanel(false); notify("Keys saved to browser!"); }}>Save keys</button>
                    </div>
                  )}
                </div>

                {/* Upload form */}
                <div className="admin-sec">
                  <h3 style={{ fontFamily: "DM Sans", fontSize: 16, fontWeight: 600, marginBottom: 22, color: NAVY_TEXT }}>Upload new image</h3>
                  <div className="drop-zone" onClick={() => !uploading && fileInputRef.current?.click()}>
                    {uploadPreview ? (
                      <div>
                        <img src={uploadPreview} alt="preview" style={{ maxHeight: 200, maxWidth: "100%", borderRadius: 10, objectFit: "contain", marginBottom: 10 }} />
                        <p style={{ fontSize: 13, color: NAVY_MUTED, fontFamily: "DM Sans" }}>{uploadFile?.name} · {(uploadFile?.size / 1024 / 1024).toFixed(1)}MB</p>
                        {!uploading && <p style={{ fontSize: 12, color: "#60a5fa", marginTop: 5, fontFamily: "DM Sans" }}>Click to change</p>}
                      </div>
                    ) : (
                      <div>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={NAVY_BORDER} strokeWidth="1.5" style={{ margin: "0 auto 14px", display: "block" }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 6, color: NAVY_TEXT, fontFamily: "DM Sans" }}>Click to select image</p>
                        <p style={{ fontSize: 13, color: NAVY_MUTED, fontFamily: "DM Sans" }}>JPG, PNG, WEBP, GIF — up to 200MB</p>
                      </div>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileSelect} />

                  {uploading && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                        <span style={{ fontSize: 12, color: NAVY_MUTED, fontFamily: "DM Sans" }}>Uploading to Internet Archive…</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: GOLD, fontFamily: "DM Sans" }}>{uploadProgress}%</span>
                      </div>
                      <div className="progress-bar"><div className="progress-fill" style={{ width: `${uploadProgress}%` }} /></div>
                      <p style={{ fontSize: 11, color: NAVY_MUTED, marginTop: 7, fontFamily: "DM Sans" }}>Large files may take a few minutes. Do not close this tab.</p>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 4 }}>
                    <div>
                      <label className="admin-label">Title *</label>
                      <input style={navyInp} placeholder="e.g. Golden Horizon" value={uploadForm.title} onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))} disabled={uploading} />
                    </div>
                    <div>
                      <label className="admin-label">Type</label>
                      <select style={{ ...navyInp, cursor: "pointer" }} value={uploadForm.type} onChange={e => setUploadForm(f => ({ ...f, type: e.target.value }))} disabled={uploading}>
                        <option value="photography">Photography</option>
                        <option value="artwork">Artwork</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: "1/-1" }}>
                      <label className="admin-label">Tags (comma-separated)</label>
                      <input style={navyInp} placeholder="nature, landscape, mountain" value={uploadForm.tags} onChange={e => setUploadForm(f => ({ ...f, tags: e.target.value }))} disabled={uploading} />
                    </div>
                  </div>
                  {uploadError && <div className="err">{uploadError}</div>}
                  <button className="btn-gold" style={{ marginTop: 22, padding: "12px 36px", opacity: uploading ? 0.6 : 1, cursor: uploading ? "not-allowed" : "pointer", fontSize: 14 }}
                    onClick={handleUpload} disabled={uploading}>
                    {uploading ? `Uploading… ${uploadProgress}%` : "Upload to Internet Archive"}
                  </button>
                </div>
              </div>
            )}

            {/* IMAGES TAB */}
            {adminTab === "images" && (
              <div>
                <h3 style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 600, marginBottom: 16, color: NAVY_TEXT }}>All images ({images.length})</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {images.map(img => (
                    <div key={img.id} className="img-row">
                      <img src={img.url} alt={img.title} style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                        onError={e => { e.target.style.background = NAVY_LIGHT; e.target.style.opacity = "0.5"; }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: NAVY_TEXT, fontFamily: "DM Sans" }}>{img.title}</p>
                        <p style={{ fontSize: 12, color: NAVY_MUTED, fontFamily: "DM Sans" }}>{(img.tags || []).join(", ")} · {img.downloads ?? 0} downloads</p>
                      </div>
                      <span className="pill">{img.type || "photo"}</span>
                      <button className="btn-red" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => handleDelete(img)}>Delete</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* USERS TAB */}
            {adminTab === "users" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 600, color: NAVY_TEXT }}>Registered users</h3>
                    <p style={{ fontSize: 13, color: NAVY_MUTED, fontFamily: "DM Sans", marginTop: 4 }}>{users.length} total accounts</p>
                  </div>
                  <button className="btn-navy" onClick={loadUsers} style={{ fontSize: 13 }}>Refresh</button>
                </div>
                {loadingUsers
                  ? <div style={{ textAlign: "center", padding: "60px 0", color: NAVY_MUTED, fontFamily: "DM Sans" }}>Loading users…</div>
                  : users.length === 0
                    ? <div style={{ textAlign: "center", padding: "60px 0", color: NAVY_MUTED, fontFamily: "DM Sans" }}>No users registered yet.</div>
                    : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {users.map((u, idx) => (
                          <div key={u.id} className="user-row">
                            <div style={{ width: 40, height: 40, borderRadius: "50%", background: NAVY_BORDER, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                              {u.photoURL
                                ? <img src={u.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : <span style={{ fontSize: 16, color: GOLD, fontFamily: "DM Sans", fontWeight: 600 }}>{(u.email || u.displayName || "?")[0].toUpperCase()}</span>
                              }
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 14, fontWeight: 500, color: NAVY_TEXT, fontFamily: "DM Sans", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {u.displayName || u.email || "Anonymous"}
                              </p>
                              <p style={{ fontSize: 12, color: NAVY_MUTED, fontFamily: "DM Sans" }}>
                                {u.email} {u.provider && `· ${u.provider.replace(".com", "")}`}
                              </p>
                            </div>
                            <span style={{ fontSize: 11, color: NAVY_MUTED, fontFamily: "DM Sans", marginRight: 8 }}>
                              {(u.saved || []).length} saved
                            </span>
                            <button className="btn-red" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => handleDeleteUser(u)}>Remove</button>
                          </div>
                        ))}
                      </div>
                }
              </div>
            )}
          </div>
        </div>
      )}

      {/* IMAGE DETAIL */}
      {selectedImage && (
        <div className="overlay" onClick={() => setSelectedImage(null)}>
          <div className="detail-modal" onClick={e => e.stopPropagation()}>
            <img src={selectedImage.url} alt={selectedImage.title} style={{ width: "56%", objectFit: "cover", flexShrink: 0 }} />
            <div style={{ padding: 32, flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
                <button className="close-btn" onClick={() => setSelectedImage(null)}>✕</button>
              </div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 600, marginBottom: 6, color: "#1a1a1a" }}>{selectedImage.title}</h2>
              <p style={{ fontSize: 13, color: "#aaa", marginBottom: 16, fontFamily: "DM Sans" }}>{selectedImage.downloads ?? 0} downloads</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 22 }}>
                {(selectedImage.tags || []).map(tag => <span key={tag} style={{ padding: "3px 12px", borderRadius: 999, fontSize: 12, background: "#f0f0f0", color: "#555", fontFamily: "DM Sans" }}>{tag}</span>)}
              </div>
              <div style={{ marginBottom: 22 }}>
                <p style={{ fontSize: 11, color: "#aaa", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "DM Sans" }}>Share this visual</p>
                <ShareButtons img={selectedImage} />
              </div>
              <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                <button className="btn-blk" style={{ width: "100%", padding: 13 }} onClick={() => handleDownload(selectedImage)}>Download free</button>
                <button className="btn-wht" style={{ width: "100%", padding: 13 }} onClick={() => handleSave(selectedImage)}>
                  {savedIds.includes(selectedImage.id) ? "Remove from saved" : "Save to collection"}
                </button>
                {isAdmin && <button className="btn-red" style={{ width: "100%", padding: 13 }} onClick={() => handleDelete(selectedImage)}>Delete image</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SHARE MODAL */}
      {shareImage && (
        <div className="overlay" onClick={() => setShareImage(null)}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 32, maxWidth: 420, width: "100%" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: "#1a1a1a" }}>Share "{shareImage.title}"</h3>
              <button className="close-btn" onClick={() => setShareImage(null)}>✕</button>
            </div>
            <img src={shareImage.url} alt={shareImage.title} style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: 12, marginBottom: 20 }} />
            <ShareButtons img={shareImage} />
          </div>
        </div>
      )}

      {/* AUTH MODAL */}
      {showAuth && (
        <div className="overlay" onClick={() => { setShowAuth(false); setAuthError(""); }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 36, maxWidth: 460, width: "100%" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: "#1a1a1a" }}>{authMode === "login" ? "Welcome back" : "Create account"}</h2>
              <button className="close-btn" onClick={() => { setShowAuth(false); setAuthError(""); }}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 24, fontFamily: "DM Sans" }}>
              {authMode === "login" ? "Sign in to save your favourite visuals" : "Join free — build your personal collection"}
            </p>

            {/* Social login buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              <button className="social-btn" onClick={() => handleSocialLogin(googleProvider)} disabled={authBusy}>
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue with Google
              </button>
              <button className="social-btn" onClick={() => handleSocialLogin(githubProvider)} disabled={authBusy}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#1a1a1a"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                Continue with GitHub
              </button>
              <button className="social-btn" onClick={() => handleSocialLogin(facebookProvider)} disabled={authBusy}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877f2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Continue with Facebook
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: "#e0e0e0" }} />
              <span style={{ fontSize: 12, color: "#aaa", fontFamily: "DM Sans" }}>or use email</span>
              <div style={{ flex: 1, height: 1, background: "#e0e0e0" }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input style={inp} placeholder="Email address" type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
              <input style={inp} placeholder="Password" type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAuth()} />
              {authMode === "signup" && <input style={inp} placeholder="Confirm password" type="password" value={authConfirm} onChange={e => setAuthConfirm(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAuth()} />}
            </div>
            {authError && <div style={{ marginTop: 12, padding: "11px 15px", background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: 9, fontSize: 13, color: "#b91c1c", fontFamily: "DM Sans" }}>{authError}</div>}
            <button className="btn-blk" style={{ width: "100%", marginTop: 16, padding: 13, opacity: authBusy ? 0.6 : 1, fontSize: 14 }} onClick={handleAuth} disabled={authBusy}>
              {authBusy ? "Please wait…" : authMode === "login" ? "Sign in" : "Create free account"}
            </button>
            <p style={{ fontSize: 13, textAlign: "center", marginTop: 16, color: "#888", fontFamily: "DM Sans" }}>
              {authMode === "login" ? "No account? " : "Already have one? "}
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "#1a1a1a", fontWeight: 600, fontSize: 13, fontFamily: "DM Sans" }} onClick={() => { setAuthMode(m => m === "login" ? "signup" : "login"); setAuthError(""); }}>
                {authMode === "login" ? "Sign up free" : "Sign in"}
              </button>
            </p>
            <p style={{ fontSize: 12, textAlign: "center", marginTop: 10, color: "#ccc", fontFamily: "DM Sans" }}>
              Or <button style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", textDecoration: "underline", fontSize: 12, fontFamily: "DM Sans" }} onClick={() => { setShowAuth(false); setAuthError(""); }}>continue as guest</button>
            </p>
          </div>
        </div>
      )}

      {/* ADMIN LOGIN */}
      {showAdminLogin && (
        <div className="overlay" onClick={() => { setShowAdminLogin(false); setAdminError(""); }}>
          <div style={{ background: NAVY_LIGHT, borderRadius: 20, padding: 36, maxWidth: 380, width: "100%", border: `1px solid ${NAVY_BORDER}` }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, color: "#fff" }}>Admin access</h2>
              <button style={{ width: 34, height: 34, borderRadius: "50%", background: NAVY_BORDER, border: "none", cursor: "pointer", fontSize: 15, color: NAVY_TEXT, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }} onClick={() => { setShowAdminLogin(false); setAdminError(""); }}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: NAVY_MUTED, marginBottom: 24, fontFamily: "DM Sans" }}>Enter the admin password to manage content</p>
            <input style={navyInp} placeholder="Password" type="password" value={adminPass} onChange={e => setAdminPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdminLogin()} />
            {adminError && <div style={{ marginTop: 10, padding: "11px 15px", background: "rgba(226,75,74,0.15)", border: "1px solid rgba(226,75,74,0.4)", borderRadius: 9, fontSize: 13, color: "#ff8080", fontFamily: "DM Sans" }}>{adminError}</div>}
            <button className="btn-gold" style={{ width: "100%", marginTop: 18, padding: 13, fontSize: 14 }} onClick={handleAdminLogin}>Enter admin panel</button>
          </div>
        </div>
      )}

      {/* ACCOUNT NUDGE */}
      {showAccountNudge && (
        <div className="overlay" onClick={() => setShowAccountNudge(false)}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 36, maxWidth: 400, width: "100%", textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#f5f5f3", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </div>
            <h2 style={{ fontFamily: "'Gondens', 'Cormorant Garamond', serif", fontSize: 26, marginBottom: 8, color: "#1a1a1a" }}>Enjoying Melania?</h2>
            <p style={{ fontSize: 14, color: "#888", marginBottom: 6, fontFamily: "DM Sans" }}>You've used your {GUEST_DOWNLOAD_LIMIT} guest downloads.</p>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 28, fontFamily: "DM Sans" }}>Create a <strong style={{ color: "#1a1a1a" }}>free account</strong> for unlimited downloads.</p>
            <button className="btn-blk" style={{ width: "100%", padding: 13, marginBottom: 10, fontSize: 14 }} onClick={() => { setShowAccountNudge(false); setAuthMode("signup"); setShowAuth(true); }}>Create free account</button>
            <button className="btn-wht" style={{ width: "100%", padding: 13, marginBottom: 16 }} onClick={() => { setShowAccountNudge(false); setAuthMode("login"); setShowAuth(true); }}>Sign in</button>
            <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#bbb", textDecoration: "underline", fontFamily: "DM Sans" }} onClick={() => setShowAccountNudge(false)}>Maybe later</button>
          </div>
        </div>
      )}

      {notification && <div className={`notif notif-${notification.type}`}>{notification.msg}</div>}
    </div>
  );
}
