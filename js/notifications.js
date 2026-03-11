// Notifications management logic
document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged(user => {
    if (user) {
      loadNotifications();
    } else {
      window.location.href = "index.html";
    }
  });
});

async function loadNotifications() {
  const user = auth.currentUser;
  if (!user) return;

  const list = document.getElementById("notifications-list");
  const empty = document.getElementById("empty-notifications");
  
  try {
    list.innerHTML = '<div class="spinner"></div>';
    
    const snapshot = await db.collection("notifications")
      .where("recipientUid", "==", user.uid)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    
    if (snapshot.empty) {
      list.innerHTML = "";
      empty.style.display = "block";
      return;
    }
    
    empty.style.display = "none";
    list.innerHTML = "";
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const item = createNotificationItem(doc.id, data);
      list.appendChild(item);
    });
  } catch (error) {
    console.error("Error loading notifications:", error);
    showToast("Error loading notifications", "error");
  }
}

function createNotificationItem(id, data) {
  const item = document.createElement("div");
  item.className = "notification-item";
  item.style.background = data.read ? "rgba(30, 41, 59, 0.5)" : "#1e293b";
  item.style.padding = "1.25rem";
  item.style.borderRadius = "16px";
  item.style.border = data.read ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid #6366f1";
  item.style.display = "flex";
  item.style.alignItems = "center";
  item.style.gap = "1rem";
  item.style.cursor = "pointer";
  item.onclick = () => handleNotificationClick(id, data);

  let icon = "🔔";
  let message = "";
  
  if (data.type === 'like') {
    icon = "❤️";
    message = `<strong>${data.senderName}</strong> liked your pin "${data.relatedTitle || 'Untitled'}"`;
  } else if (data.type === 'comment') {
    icon = "💬";
    message = `<strong>${data.senderName}</strong> commented on your pin "${data.relatedTitle || 'Untitled'}"`;
  } else if (data.type === 'follow') {
    icon = "👤";
    message = `<strong>${data.senderName}</strong> started following you`;
  }

  const time = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleDateString() : "N/A";

  item.innerHTML = `
    <div style="font-size: 1.5rem;">${icon}</div>
    <div style="flex: 1;">
      <p style="margin: 0; color: #fff; font-size: 0.95rem;">${message}</p>
      <span style="font-size: 0.8rem; color: #64748b;">${time}</span>
    </div>
    ${!data.read ? '<div style="width: 8px; height: 8px; background: #6366f1; border-radius: 50%;"></div>' : ''}
  `;
  
  return item;
}

async function handleNotificationClick(id, data) {
  try {
    await db.collection("notifications").doc(id).update({ read: true });
    
    if (data.type === 'like' || data.type === 'comment') {
      window.location.href = `index.html?pin=${data.relatedId}`; // Open gallery with pin selected
    } else if (data.type === 'follow') {
      window.location.href = `profile.html?uid=${data.senderUid}`;
    }
  } catch (error) {
    console.error("Error handling notification click:", error);
  }
}

async function markAllAsRead() {
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    const snapshot = await db.collection("notifications")
      .where("recipientUid", "==", user.uid)
      .where("read", "==", false)
      .get();
      
    const batch = db.batch();
    snapshot.forEach(doc => {
      batch.update(doc.ref, { read: true });
    });
    
    await batch.commit();
    showToast("All marked as read", "success");
    loadNotifications();
  } catch (error) {
    console.error("Error marking all as read:", error);
  }
}
