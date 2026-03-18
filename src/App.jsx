import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
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

const ADMIN_PASS = "admin123";
const GUEST_DOWNLOAD_LIMIT = 3;
const SCRIPTURE = `"Son of man, I have made you a watchman for the people of Israel; so hear the word I speak and give them warning from me." — Ezekiel 33:7 (NIV)`;
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

export default function App() {
  const [view, setView] = useState("gallery");
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

  const notify = (msg, type = "success") => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 3500); };

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
          else await setDoc(doc(db, "users", u.uid), { saved: [], email: u.email });
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
      xhr.setRequestHeader("x-archive-meta-description", `Uploaded via Watchman - ${uploadForm.type}`);
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
      notify("Image uploaded & live on Watchman!");
    } catch (err) { setUploadError(err.message); }
    finally { setUploading(false); }
  };

  const handleDelete = async (img) => {
    if (!img.id?.startsWith("s")) {
      try { await deleteDoc(doc(db, "images", img.id)); } catch {}
    }
    setImages(prev => prev.filter(i => i.id !== img.id));
    if (selectedImage?.id === img.id) setSelectedImage(null);
    notify("Image deleted.");
  };

  const savedImages = images.filter(i => savedIds.includes(i.id));
  const inp = { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #d0d0d0", background: "#fff", color: "#1a1a1a", fontFamily: "'DM Sans', sans-serif", fontSize: 14, outline: "none" };

  const ShareButtons = ({ img }) => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {[
        { key: "facebook", label: "Facebook", bg: "#1877f2", color: "#fff" },
        { key: "twitter", label: "X / Twitter", bg: "#000", color: "#fff" },
        { key: "whatsapp", label: "WhatsApp", bg: "#25d366", color: "#fff" },
        { key: "copy", label: "Copy link", bg: "#f0f0f0", color: "#1a1a1a" },
      ].map(s => (
        <button key={s.key} onClick={() => handleShare(s.key, img)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12, fontFamily: "DM Sans", fontWeight: 500, background: s.bg, color: s.color, transition: "opacity 0.2s" }}
          onMouseOver={e => e.currentTarget.style.opacity = "0.82"} onMouseOut={e => e.currentTarget.style.opacity = "1"}>
          {s.label}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#fafaf8" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .serif { font-family: 'Cormorant Garamond', Georgia, serif; }
        .nav-wrap { position: fixed; top: 0; left: 0; right: 0; z-index: 50; transition: all 0.35s ease; }
        .nav-scrolled { background: rgba(5,5,5,0.94); backdrop-filter: blur(14px); box-shadow: 0 1px 24px rgba(0,0,0,0.25); }
        .nav-top { background: #000; }
        .nav-inner { max-width: 1300px; margin: 0 auto; padding: 0 28px; height: 66px; display: flex; align-items: center; justify-content: space-between; }
        .nl { background: none; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; letter-spacing: 0.03em; padding: 6px 13px; border-radius: 6px; transition: all 0.2s; color: rgba(255,255,255,0.55); }
        .nl:hover { color: #fff; background: rgba(255,255,255,0.07); }
        .nl.on { color: #fff; background: rgba(255,255,255,0.1); }
        .card-wrap { break-inside: avoid; margin-bottom: 18px; position: relative; border-radius: 14px; overflow: hidden; cursor: pointer; animation: fadeUp 0.5s ease both; }
        .card-wrap img { width: 100%; display: block; object-fit: cover; transition: transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94); }
        .card-wrap:hover img { transform: scale(1.05); }
        .card-ov { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 55%, transparent 100%); opacity: 0; transition: opacity 0.3s; display: flex; flex-direction: column; justify-content: flex-end; padding: 14px; }
        .card-wrap:hover .card-ov { opacity: 1; }
        .ca { display: flex; gap: 6px; }
        .ca-btn { padding: 6px 11px; border-radius: 8px; border: none; cursor: pointer; font-size: 11px; font-family: 'DM Sans', sans-serif; font-weight: 500; display: flex; align-items: center; gap: 4px; transition: transform 0.15s; }
        .ca-btn:hover { transform: translateY(-1px); }
        .masonry { columns: 3; column-gap: 18px; }
        @media (max-width: 900px) { .masonry { columns: 2; } }
        @media (max-width: 560px) { .masonry { columns: 1; } }
        .btn-blk { background: #1a1a1a; color: #fff; border: none; border-radius: 9px; padding: 11px 24px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: background 0.2s; }
        .btn-blk:hover { background: #2d2d2d; }
        .btn-wht { background: #fff; color: #1a1a1a; border: 1px solid #ddd; border-radius: 9px; padding: 11px 24px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .btn-wht:hover { background: #f5f5f5; }
        .btn-red { background: #e24b4a; color: #fff; border: none; border-radius: 9px; padding: 9px 18px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: background 0.2s; }
        .btn-red:hover { background: #c03030; }
        .close-btn { width: 34px; height: 34px; border-radius: 50%; background: #f0f0f0; border: none; cursor: pointer; font-size: 15px; color: #1a1a1a; display: flex; align-items: center; justify-content: center; font-weight: 700; transition: background 0.2s; flex-shrink: 0; }
        .close-btn:hover { background: #e0e0e0; }
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 20px; }
        .search-bar { display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid #e8e8e8; border-radius: 999px; padding: 10px 20px; max-width: 480px; width: 100%; box-shadow: 0 2px 16px rgba(0,0,0,0.06); }
        .search-bar input { border: none; background: transparent; outline: none; font-size: 14px; color: #1a1a1a; font-family: 'DM Sans', sans-serif; width: 100%; }
        .notif { position: fixed; bottom: 28px; right: 28px; padding: 13px 22px; border-radius: 12px; font-size: 13px; font-family: 'DM Sans', sans-serif; z-index: 999; animation: slideUp 0.3s ease; max-width: 320px; font-weight: 500; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
        .notif-success { background: #1a1a1a; color: #fff; }
        .notif-error { background: #e24b4a; color: #fff; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .admin-sec { background: #fff; border: 1px solid #ebebeb; border-radius: 18px; padding: 28px; margin-bottom: 24px; }
        .drop-zone { border: 2px dashed #d0d0d0; border-radius: 14px; padding: 40px 24px; text-align: center; cursor: pointer; transition: all 0.2s; background: #fafaf8; }
        .drop-zone:hover { border-color: #1a1a1a; background: #f5f5f3; }
        .progress-bar { height: 5px; background: #ebebeb; border-radius: 999px; overflow: hidden; }
        .progress-fill { height: 100%; background: #1a1a1a; border-radius: 999px; transition: width 0.3s ease; }
        .img-row { display: flex; align-items: center; gap: 14px; background: #fff; border: 1px solid #ebebeb; border-radius: 12px; padding: 11px 16px; transition: box-shadow 0.2s; }
        .img-row:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
        .pill { display: inline-block; padding: 3px 11px; border-radius: 999px; font-size: 11px; background: #f0f0f0; color: #666; font-family: 'DM Sans', sans-serif; }
        .err { margin-top: 12px; padding: 11px 15px; background: #fff5f5; border: 1px solid #fca5a5; border-radius: 9px; font-size: 13px; color: #b91c1c; font-family: 'DM Sans', sans-serif; }
        .admin-label { font-size: 12px; color: #666; display: block; margin-bottom: 7px; font-family: 'DM Sans', sans-serif; font-weight: 500; }
        .detail-modal { background: #fff; border-radius: 22px; overflow: hidden; max-width: 920px; width: 100%; display: flex; max-height: 90vh; }
        @media (max-width: 640px) { .detail-modal { flex-direction: column; } .detail-modal > img { width: 100% !important; height: 220px !important; } }
      `}</style>

      {/* NAV */}
      <nav className={`nav-wrap ${scrolled ? "nav-scrolled" : "nav-top"}`}>
        <div className="nav-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ border: "2px solid #fff", padding: "3px 14px", cursor: "pointer", borderRadius: 2 }} onClick={() => setView("gallery")}>
              <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 17, fontWeight: 600, color: "#fff", letterSpacing: "0.12em", textTransform: "uppercase" }}>Watchman</span>
            </div>
            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>|</span>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "DM Sans" }}>To Watchmen</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button className={`nl ${view === "gallery" ? "on" : ""}`} onClick={() => setView("gallery")}>Explore</button>
            {user && <button className={`nl ${view === "saved" ? "on" : ""}`} onClick={() => setView("saved")}>Saved {savedIds.length > 0 && `(${savedIds.length})`}</button>}
            {isAdmin && <button className={`nl ${view === "admin" ? "on" : ""}`} onClick={() => setView("admin")}>Admin</button>}
            {!user && guestDownloads > 0 && (
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", padding: "3px 10px", background: "rgba(255,255,255,0.07)", borderRadius: 999, marginRight: 4 }}>
                {GUEST_DOWNLOAD_LIMIT - guestDownloads} left
              </span>
            )}
            {!isAdmin && <button className="nl" style={{ color: "rgba(255,255,255,0.25)" }} onClick={() => setShowAdminLogin(true)}>Admin</button>}
            {user
              ? <button style={{ marginLeft: 8, padding: "7px 18px", border: "1px solid rgba(255,255,255,0.18)", color: "#fff", background: "transparent", borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans", fontSize: 13 }} onClick={handleSignOut}>Sign out</button>
              : <button style={{ marginLeft: 8, padding: "7px 18px", background: "#fff", color: "#000", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "DM Sans", fontSize: 13, fontWeight: 600 }} onClick={() => setShowAuth(true)}>Sign in</button>
            }
          </div>
        </div>
      </nav>

      {/* GALLERY */}
      {view === "gallery" && (
        <div>
          <div style={{ padding: "116px 28px 52px", maxWidth: 1300, margin: "0 auto" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#000", color: "#fff", padding: "5px 18px 5px 5px", borderRadius: 999, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "DM Sans", fontWeight: 500, marginBottom: 24 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="#000"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </div>
              Watchman to Watchmen
            </div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "clamp(36px, 5.5vw, 68px)", fontWeight: 600, letterSpacing: "-2px", lineHeight: 1.02, marginBottom: 18, color: "#0a0a0a" }}>
              Watcher On The Wall.<br />
              <span style={{ fontStyle: "italic", color: "#555" }}>Narrow Pather.</span>
            </h1>
            <p style={{ fontSize: 15, color: "#666", marginBottom: 14, maxWidth: 560, lineHeight: 1.75, fontFamily: "DM Sans" }}>
              Midnight Crier — Curated photography & artwork freely shared for the body of Christ.
            </p>
            <blockquote style={{ borderLeft: "3px solid #1a1a1a", paddingLeft: 18, marginBottom: 38, maxWidth: 540 }}>
              <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 17, fontStyle: "italic", color: "#444", lineHeight: 1.85 }}>
                {SCRIPTURE}
              </p>
            </blockquote>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div className="search-bar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input placeholder="Search visuals, tags…" value={search} onChange={e => setSearch(e.target.value)} />
                {search && <button style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: 14 }} onClick={() => setSearch("")}>✕</button>}
              </div>
              <span style={{ fontSize: 13, color: "#aaa", fontFamily: "DM Sans" }}>{filtered.length} visuals</span>
              {user && <span style={{ fontSize: 13, color: "#888", fontFamily: "DM Sans" }}>· {user.email}</span>}
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
                        <img
                          src={img.url}
                          alt={img.title}
                          style={{ height: h }}
                          onClick={() => setSelectedImage(img)}
                          loading="lazy"
                          onError={e => {
                            e.target.style.display = "none";
                            e.target.nextSibling.style.display = "flex";
                          }}
                          onLoad={e => {
                            e.target.style.display = "block";
                            e.target.nextSibling.style.display = "none";
                          }}
                        />
                        <div onClick={() => setSelectedImage(img)} style={{ display: "none", height: h, background: "#1a1a1a", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, cursor: "pointer" }}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "DM Sans", textAlign: "center", padding: "0 12px" }}>{img.title}</p>
                          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, fontFamily: "DM Sans" }}>Processing — check back soon</p>
                        </div>
                        <div className="card-ov" onClick={() => setSelectedImage(img)}>
                          <p style={{ color: "#fff", fontSize: 13, fontWeight: 500, marginBottom: 9, fontFamily: "DM Sans", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>{img.title}</p>
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
                    ))}
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

      {/* ADMIN */}
      {view === "admin" && isAdmin && (
        <div style={{ padding: "100px 28px 80px", maxWidth: 960, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
            <div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 600 }}>Admin panel</h2>
              <p style={{ fontSize: 14, color: "#888", marginTop: 4, fontFamily: "DM Sans" }}>Upload and manage all Watchman content</p>
            </div>
            <span className="pill">{images.filter(i => !i.id?.startsWith("s")).length} uploaded</span>
          </div>

          {/* IA Keys */}
          <div className="admin-sec">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setShowKeysPanel(p => !p)}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: iaKeys.accessKey ? "#22c55e" : "#f59e0b", flexShrink: 0 }} />
                <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 500, color: "#1a1a1a" }}>
                  Internet Archive — {iaKeys.accessKey ? "keys saved ✓" : "keys not set"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#3b82f6", textDecoration: "underline", fontFamily: "DM Sans" }}
                  onClick={e => { e.stopPropagation(); setShowKeysHelp(h => !h); }}>
                  How to get keys?
                </button>
                <span style={{ fontSize: 12, color: "#888", fontFamily: "DM Sans" }}>{showKeysPanel ? "▲" : "▼"}</span>
              </div>
            </div>
            {showKeysPanel && (
              <div style={{ marginTop: 20 }}>
                {showKeysHelp && (
                  <div style={{ background: "#f8f8f6", borderRadius: 10, padding: 16, marginBottom: 18, fontSize: 13, lineHeight: 1.9, color: "#555", fontFamily: "DM Sans" }}>
                    1. Go to <strong style={{ color: "#1a1a1a" }}>archive.org</strong> → create a free account<br />
                    2. Visit <strong style={{ color: "#1a1a1a" }}>archive.org/account/s3.php</strong><br />
                    3. Click <strong style={{ color: "#1a1a1a" }}>"Generate new keys"</strong><br />
                    4. Paste your keys below — they are saved automatically, you only do this once.
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label className="admin-label">Access key</label>
                    <input style={inp} placeholder="Your IA access key" type="text" value={iaKeys.accessKey} onChange={e => setIaKeys(k => ({ ...k, accessKey: e.target.value }))} />
                  </div>
                  <div>
                    <label className="admin-label">Secret key</label>
                    <input style={inp} placeholder="Your IA secret key" type="password" value={iaKeys.secretKey} onChange={e => setIaKeys(k => ({ ...k, secretKey: e.target.value }))} />
                  </div>
                </div>
                <button className="btn-blk" style={{ marginTop: 14, fontSize: 13 }} onClick={() => { setShowKeysPanel(false); notify("Keys saved to browser!"); }}>Save keys</button>
              </div>
            )}
          </div>

          {/* Upload */}
          <div className="admin-sec">
            <h3 style={{ fontFamily: "DM Sans", fontSize: 16, fontWeight: 600, marginBottom: 22, color: "#1a1a1a" }}>Upload new image</h3>
            <div className="drop-zone" onClick={() => !uploading && fileInputRef.current?.click()}>
              {uploadPreview ? (
                <div>
                  <img src={uploadPreview} alt="preview" style={{ maxHeight: 200, maxWidth: "100%", borderRadius: 10, objectFit: "contain", marginBottom: 10 }} />
                  <p style={{ fontSize: 13, color: "#666", fontFamily: "DM Sans" }}>{uploadFile?.name} · {(uploadFile?.size / 1024 / 1024).toFixed(1)}MB</p>
                  {!uploading && <p style={{ fontSize: 12, color: "#3b82f6", marginTop: 5, fontFamily: "DM Sans" }}>Click to change</p>}
                </div>
              ) : (
                <div>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" style={{ margin: "0 auto 14px", display: "block" }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 6, color: "#333", fontFamily: "DM Sans" }}>Click to select image</p>
                  <p style={{ fontSize: 13, color: "#aaa", fontFamily: "DM Sans" }}>JPG, PNG, WEBP, GIF — up to 200MB</p>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileSelect} />

            {uploading && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{ fontSize: 13, color: "#666", fontFamily: "DM Sans" }}>Uploading to Internet Archive…</span>
                  <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "DM Sans" }}>{uploadProgress}%</span>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${uploadProgress}%` }} /></div>
                <p style={{ fontSize: 12, color: "#aaa", marginTop: 7, fontFamily: "DM Sans" }}>Large files may take a few minutes. Do not close this tab.</p>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 4 }}>
              <div>
                <label className="admin-label">Title *</label>
                <input style={inp} placeholder="e.g. Golden Horizon" value={uploadForm.title} onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))} disabled={uploading} />
              </div>
              <div>
                <label className="admin-label">Type</label>
                <select style={{ ...inp, cursor: "pointer" }} value={uploadForm.type} onChange={e => setUploadForm(f => ({ ...f, type: e.target.value }))} disabled={uploading}>
                  <option value="photography">Photography</option>
                  <option value="artwork">Artwork</option>
                </select>
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label className="admin-label">Tags (comma-separated)</label>
                <input style={inp} placeholder="nature, landscape, mountain" value={uploadForm.tags} onChange={e => setUploadForm(f => ({ ...f, tags: e.target.value }))} disabled={uploading} />
              </div>
            </div>
            {uploadError && <div className="err">{uploadError}</div>}
            <button className="btn-blk" style={{ marginTop: 22, padding: "12px 32px", opacity: uploading ? 0.6 : 1, cursor: uploading ? "not-allowed" : "pointer", fontSize: 14 }}
              onClick={handleUpload} disabled={uploading}>
              {uploading ? `Uploading… ${uploadProgress}%` : "Upload to Internet Archive"}
            </button>
          </div>

          {/* Image list */}
          <h3 style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 600, marginBottom: 16, color: "#1a1a1a" }}>All images ({images.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {images.map(img => (
              <div key={img.id} className="img-row">
                <img src={img.url} alt={img.title} style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#1a1a1a", fontFamily: "DM Sans" }}>{img.title}</p>
                  <p style={{ fontSize: 12, color: "#999", fontFamily: "DM Sans" }}>{(img.tags || []).join(", ")} · {img.downloads ?? 0} downloads</p>
                </div>
                <span className="pill">{img.type || "photo"}</span>
                {img.id?.startsWith("s")
                  ? <button className="btn-red" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => handleDelete(img)}>Delete</button>
                  : <button className="btn-red" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => handleDelete(img)}>Delete</button>
                }
              </div>
            ))}
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
                {(selectedImage.tags || []).map(tag => <span key={tag} className="pill">{tag}</span>)}
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
                {isAdmin && !selectedImage.id?.startsWith("s") && (
                  <button className="btn-red" style={{ width: "100%", padding: 13 }} onClick={() => handleDelete(selectedImage)}>Delete image</button>
                )}
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

      {/* AUTH */}
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
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input style={inp} placeholder="Email address" type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
              <input style={inp} placeholder="Password" type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAuth()} />
              {authMode === "signup" && <input style={inp} placeholder="Confirm password" type="password" value={authConfirm} onChange={e => setAuthConfirm(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAuth()} />}
            </div>
            {authError && <div style={{ marginTop: 12, padding: "11px 15px", background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: 9, fontSize: 13, color: "#b91c1c", fontFamily: "DM Sans" }}>{authError}</div>}
            <button className="btn-blk" style={{ width: "100%", marginTop: 18, padding: 13, opacity: authBusy ? 0.6 : 1, fontSize: 14 }} onClick={handleAuth} disabled={authBusy}>
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
          <div style={{ background: "#fff", borderRadius: 20, padding: 36, maxWidth: 380, width: "100%" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, color: "#1a1a1a" }}>Admin access</h2>
              <button className="close-btn" onClick={() => { setShowAdminLogin(false); setAdminError(""); }}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 24, fontFamily: "DM Sans" }}>Enter the admin password to manage content</p>
            <input style={inp} placeholder="Password" type="password" value={adminPass} onChange={e => setAdminPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdminLogin()} />
            {adminError && <div style={{ marginTop: 10, padding: "11px 15px", background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: 9, fontSize: 13, color: "#b91c1c", fontFamily: "DM Sans" }}>{adminError}</div>}
            <button className="btn-blk" style={{ width: "100%", marginTop: 18, padding: 13, fontSize: 14 }} onClick={handleAdminLogin}>Enter admin panel</button>
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
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, marginBottom: 8, color: "#1a1a1a" }}>Enjoying Watchman?</h2>
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
