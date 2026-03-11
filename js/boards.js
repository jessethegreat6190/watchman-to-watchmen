// Boards management logic
document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged(user => {
    if (user) {
      loadBoards();
    } else {
      window.location.href = "index.html";
    }
  });
});

async function loadBoards() {
  const user = auth.currentUser;
  if (!user) return;

  const boardsGrid = document.getElementById("boards-grid");
  const emptyBoards = document.getElementById("empty-boards");
  
  try {
    boardsGrid.innerHTML = '<div class="spinner"></div>';
    
    const snapshot = await db.collection("boards")
      .where("createdByUid", "==", user.uid)
      .orderBy("createdAt", "desc")
      .get();
    
    if (snapshot.empty) {
      boardsGrid.innerHTML = "";
      emptyBoards.style.display = "block";
      return;
    }
    
    emptyBoards.style.display = "none";
    boardsGrid.innerHTML = "";
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const card = createBoardCard(doc.id, data);
      boardsGrid.appendChild(card);
    });
  } catch (error) {
    console.error("Error loading boards:", error);
    showToast("Error loading boards", "error");
  }
}

function createBoardCard(boardId, data) {
  const card = document.createElement("div");
  card.className = "image-card board-card";
  card.style.background = "#1e293b";
  card.style.border = "1px solid rgba(255, 255, 255, 0.1)";
  card.style.cursor = "pointer";
  card.onclick = () => viewBoardDetails(boardId, data.name, data.description);

  const coverUrl = data.coverImageUrl || "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?q=80&w=1887&auto=format&fit=crop";
  
  card.innerHTML = `
    <div style="height: 200px; width: 100%; overflow: hidden;">
      <img src="${coverUrl}" alt="${data.name}" style="width: 100%; height: 100%; object-fit: crop;">
    </div>
    <div style="padding: 1.5rem;">
      <h3 style="margin: 0; font-size: 1.25rem;">${data.name}</h3>
      <p style="color: #94a3b8; font-size: 0.875rem; margin-top: 0.5rem;">${data.pinCount || 0} Pins</p>
      <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
        <button class="btn-delete" style="padding: 0.4rem; font-size: 0.8rem;" onclick="event.stopPropagation(); deleteBoard('${boardId}')">🗑️ Delete</button>
      </div>
    </div>
  `;
  
  return card;
}

function openCreateBoardModal() {
  document.getElementById("board-modal").style.display = "flex";
}

function closeBoardModal() {
  document.getElementById("board-modal").style.display = "none";
  document.getElementById("board-name").value = "";
  document.getElementById("board-description").value = "";
}

async function saveBoard() {
  const user = auth.currentUser;
  if (!user) return;

  const name = document.getElementById("board-name").value.trim();
  const description = document.getElementById("board-description").value.trim();

  if (!name) {
    showToast("Board name is required", "warning");
    return;
  }

  try {
    await db.collection("boards").add({
      name,
      description,
      createdByUid: user.uid,
      createdAt: new Date(),
      pinCount: 0,
      coverImageUrl: ""
    });

    showToast("Board created successfully!", "success");
    closeBoardModal();
    loadBoards();
  } catch (error) {
    console.error("Error creating board:", error);
    showToast("Error creating board", "error");
  }
}

async function viewBoardDetails(boardId, name, description) {
  const modal = document.getElementById("board-details-modal");
  const grid = document.getElementById("board-pins-grid");
  const nameEl = document.getElementById("modal-board-name");
  const descEl = document.getElementById("modal-board-description");
  
  nameEl.innerText = name;
  descEl.innerText = description || "No description provided.";
  
  modal.style.display = "flex";
  grid.innerHTML = '<div class="spinner"></div>';
  
  try {
    const snapshot = await db.collection("images")
      .where("boardId", "==", boardId)
      .orderBy("createdAt", "desc")
      .get();
      
    grid.innerHTML = "";
    
    if (snapshot.empty) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #94a3b8;">No pins in this board yet.</div>';
    } else {
      // Group pins by section
      const sections = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        const sectionName = data.section || "General";
        if (!sections[sectionName]) sections[sectionName] = [];
        sections[sectionName].push({ id: doc.id, ...data });
      });
      
      // Render pins grouped by section
      Object.keys(sections).forEach(sectionName => {
        const sectionHeader = document.createElement("div");
        sectionHeader.style.gridColumn = "1/-1";
        sectionHeader.style.padding = "2rem 0 1rem";
        sectionHeader.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
        sectionHeader.style.marginBottom = "1rem";
        sectionHeader.innerHTML = `<h3 style="margin: 0; color: #6366f1;">📂 ${sectionName}</h3>`;
        grid.appendChild(sectionHeader);
        
        sections[sectionName].forEach(pin => {
          grid.appendChild(createImageCard(pin.id, pin, false));
        });
      });
    }
  } catch (error) {
    console.error("Error loading board pins:", error);
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #ef4444;">Error loading pins.</div>';
  }
}

function closeBoardDetailsModal() {
  document.getElementById("board-details-modal").style.display = "none";
}

async function deleteBoard(boardId) {
  if (!confirm("Are you sure you want to delete this board? Pins in the board will remain in your general collection.")) return;
  
  try {
    await db.collection("boards").doc(boardId).delete();
    
    // Unlink pins from this board
    const snapshot = await db.collection("images").where("boardId", "==", boardId).get();
    const batch = db.batch();
    snapshot.forEach(doc => {
      batch.update(doc.ref, { boardId: null });
    });
    await batch.commit();
    
    showToast("Board deleted", "success");
    loadBoards();
  } catch (error) {
    console.error("Error deleting board:", error);
    showToast("Error deleting board", "error");
  }
}
