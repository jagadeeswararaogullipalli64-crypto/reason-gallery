// Reason Gallery - Application Logic with IndexedDB persistence

const CATEGORIES = [
    "Dream / Goal",
    "Inspiration",
    "Buy Later",
    "Remember",
    "Personal",
    "Other"
];

let photos = [];
let currentFilter = "All";
let currentView = "home";
let selectedCategory = CATEGORIES[0];
let pendingImageData = null;
let editingPhotoId = null;
let photoToDeleteId = null;

// IndexedDB Setup
const DB_NAME = "ReasonGalleryDB";
const STORE_NAME = "photos";
let db = null;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };
    });
}

function loadPhotosFromDB() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function savePhotoToDB(photo) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(photo);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function deletePhotoFromDB(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Seed initial data if empty
async function seedDefaultData() {
    if (photos.length === 0) {
        const samplePhoto = {
            id: 'sample-' + Date.now(),
            title: 'Dream Motorcycle',
            category: 'Dream / Goal',
            note: 'Dream bike — have to buy in 2027.',
            image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
            favorite: true,
            createdAt: Date.now()
        };
        photos.push(samplePhoto);
        await savePhotoToDB(samplePhoto);
    }
}

// Initialization
document.addEventListener("DOMContentLoaded", async () => {
    try {
        await initDB();
        photos = await loadPhotosFromDB();
        await seedDefaultData();
    } catch (err) {
        console.error("IndexedDB error, falling back to empty list:", err);
    }

    renderCategoryPills();
    renderModalChips();
    renderApp();
    setupEventListeners();
});

// Render Category Filter Pills
function renderCategoryPills() {
    const container = document.getElementById("category-pills-container");
    let html = `<button class="pill ${currentFilter === 'All' ? 'active' : ''}" data-category="All">All Photos</button>`;
    CATEGORIES.forEach(cat => {
        html += `<button class="pill ${currentFilter === cat ? 'active' : ''}" data-category="${cat}">${cat}</button>`;
    });
    container.innerHTML = html;

    container.querySelectorAll(".pill").forEach(btn => {
        btn.addEventListener("click", (e) => {
            currentFilter = e.target.dataset.category;
            renderCategoryPills();
            renderApp();
        });
    });
}

// Render Modal Chips for Reason Selection
function renderModalChips() {
    const container = document.getElementById("modal-chips-container");
    let html = "";
    CATEGORIES.forEach(cat => {
        html += `<div class="chip-option ${selectedCategory === cat ? 'selected' : ''}" data-category="${cat}">${cat}</div>`;
    });
    container.innerHTML = html;

    container.querySelectorAll(".chip-option").forEach(chip => {
        chip.addEventListener("click", (e) => {
            selectedCategory = e.target.dataset.category;
            renderModalChips();
        });
    });
}

// Main Render Dispatcher
function renderApp() {
    const searchQuery = document.getElementById("search-input").value.toLowerCase();
    
    // Filter photos based on search query and category filter
    let filtered = photos.filter(p => {
        const matchesCategory = currentFilter === "All" || p.category === currentFilter;
        const matchesSearch = p.title.toLowerCase().includes(searchQuery) ||
                              p.category.toLowerCase().includes(searchQuery) ||
                              (p.note && p.note.toLowerCase().includes(searchQuery));
        return matchesCategory && matchesSearch;
    });

    // Render Home Grid
    renderGalleryGrid("gallery-grid", filtered);
    
    // Toggle Empty State
    const emptyState = document.getElementById("empty-state");
    if (filtered.length === 0) {
        emptyState.classList.remove("hidden");
    } else {
        emptyState.classList.add("hidden");
    }

    // Render Collections View
    renderCollectionsView();

    // Render Favorites View
    const favorites = photos.filter(p => p.favorite);
    renderGalleryGrid("favorites-grid", favorites);
}

// Render Gallery Cards
function renderGalleryGrid(elementId, items) {
    const container = document.getElementById(elementId);
    if (!container) return;

    if (items.length === 0 && elementId === 'favorites-grid') {
        container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><p>No favorite photos yet. Click the heart icon on any photo to add it here!</p></div>`;
        return;
    }

    let html = "";
    items.forEach(photo => {
        html += `
            <div class="photo-card" data-id="${photo.id}">
                <div class="photo-card-media">
                    <img src="${photo.image}" alt="${escapeHtml(photo.title)}" loading="lazy">
                    <span class="badge">${escapeHtml(photo.category)}</span>
                    <button class="fav-toggle-btn ${photo.favorite ? 'active' : ''}" onclick="toggleFavorite('${photo.id}')" title="Toggle Favorite">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="${photo.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    </button>
                </div>
                <div class="photo-card-body">
                    <h3>${escapeHtml(photo.title)}</h3>
                    ${photo.note ? `<p>${escapeHtml(photo.note)}</p>` : '<p style="color:var(--text-muted); font-style:italic;">No note attached.</p>'}
                    <div class="photo-card-footer">
                        <button class="icon-action-btn" onclick="openEditModal('${photo.id}')" title="Edit Photo">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="icon-action-btn delete" onclick="promptDelete('${photo.id}')" title="Delete Photo">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// Render Collections View Grouped by Category
function renderCollectionsView() {
    const container = document.getElementById("collections-list");
    if (!container) return;

    let html = "";
    CATEGORIES.forEach(cat => {
        const catPhotos = photos.filter(p => p.category === cat);
        html += `
            <div class="collection-group">
                <h3><span>${cat}</span> <span style="font-size:0.85rem; color:var(--text-muted);">(${catPhotos.length})</span></h3>
        `;
        if (catPhotos.length === 0) {
            html += `<p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:20px;">No photos in this collection yet.</p>`;
        } else {
            html += `<div class="gallery-grid" style="margin-bottom:20px;">`;
            catPhotos.forEach(photo => {
                html += `
                    <div class="photo-card" data-id="${photo.id}">
                        <div class="photo-card-media">
                            <img src="${photo.image}" alt="${escapeHtml(photo.title)}" loading="lazy">
                            <button class="fav-toggle-btn ${photo.favorite ? 'active' : ''}" onclick="toggleFavorite('${photo.id}')">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="${photo.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                            </button>
                        </div>
                        <div class="photo-card-body">
                            <h3>${escapeHtml(photo.title)}</h3>
                            ${photo.note ? `<p>${escapeHtml(photo.note)}</p>` : ''}
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }
        html += `</div>`;
    });
    container.innerHTML = html;
}

// Event Listeners & Navigation
function setupEventListeners() {
    // Navigation tabs
    document.querySelectorAll(".bottom-nav .nav-item, .nav-item").forEach(item => {
        item.addEventListener("click", (e) => {
            const target = e.currentTarget.dataset.target;
            switchView(target);
        });
    });

    // Open Save Modal
    document.getElementById("header-save-btn").addEventListener("click", () => openSaveModal());
    document.querySelectorAll(".empty-save-btn").forEach(btn => {
        btn.addEventListener("click", () => openSaveModal());
    });

    // Close Modal
    document.getElementById("modal-close-btn").addEventListener("click", closeModal);
    document.getElementById("modal-cancel-btn").addEventListener("click", closeModal);

    // Search input
    document.getElementById("search-input").addEventListener("input", renderApp);

    // Image Drop Zone & File Input
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("photo-file-input");

    dropZone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => handleFileSelect(e.target.files[0]));

    dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.style.borderColor = "var(--accent)"; });
    dropZone.addEventListener("dragleave", () => { dropZone.style.borderColor = "var(--border-color)"; });
    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "var(--border-color)";
        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    document.getElementById("change-image-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    // Form Submission
    document.getElementById("photo-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const title = document.getElementById("photo-title-input").value.trim();
        const note = document.getElementById("photo-note-input").value.trim();

        if (!title) return alert("Please enter a title.");
        if (!pendingImageData && !editingPhotoId) return alert("Please select an image.");

        if (editingPhotoId) {
            // Update existing
            const photo = photos.find(p => p.id === editingPhotoId);
            if (photo) {
                photo.title = title;
                photo.category = selectedCategory;
                photo.note = note;
                if (pendingImageData) photo.image = pendingImageData;
                await savePhotoToDB(photo);
            }
        } else {
            // Create new
            const newPhoto = {
                id: 'photo-' + Date.now(),
                title,
                category: selectedCategory,
                note,
                image: pendingImageData,
                favorite: false,
                createdAt: Date.now()
            };
            photos.unshift(newPhoto);
            await savePhotoToDB(newPhoto);
        }

        closeModal();
        renderApp();
    });

    // Confirm Delete Modal
    document.getElementById("confirm-cancel-btn").addEventListener("click", () => {
        document.getElementById("confirm-modal").classList.add("hidden");
        photoToDeleteId = null;
    });

    document.getElementById("confirm-delete-btn").addEventListener("click", async () => {
        if (photoToDeleteId) {
            photos = photos.filter(p => p.id !== photoToDeleteId);
            await deletePhotoFromDB(photoToDeleteId);
            document.getElementById("confirm-modal").classList.add("hidden");
            photoToDeleteId = null;
            renderApp();
        }
    });

    // Settings actions
    document.getElementById("export-btn").addEventListener("click", exportBackup);
    document.getElementById("import-file").addEventListener("change", importBackup);
    document.getElementById("clear-data-btn").addEventListener("click", async () => {
        if (confirm("Are you sure you want to clear all data? This cannot be undone.")) {
            photos = [];
            const transaction = db.transaction(STORE_NAME, "readwrite");
            transaction.objectStore(STORE_NAME).clear();
            renderApp();
            alert("All data cleared.");
        }
    });
}

function switchView(viewName) {
    currentView = viewName;
    document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active"));
    document.getElementById(`view-${viewName}`).classList.add("active");

    document.querySelectorAll(".bottom-nav .nav-item").forEach(item => {
        if (item.dataset.target === viewName) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });
}

// Modal Handlers
function openSaveModal() {
    editingPhotoId = null;
    pendingImageData = null;
    document.getElementById("modal-title").textContent = "Save New Photo";
    document.getElementById("photo-id").value = "";
    document.getElementById("photo-title-input").value = "";
    document.getElementById("photo-note-input").value = "";
    selectedCategory = CATEGORIES[0];
    renderModalChips();

    document.getElementById("drop-zone-prompt").classList.remove("hidden");
    document.getElementById("preview-container").classList.add("hidden");
    document.getElementById("photo-modal").classList.remove("hidden");
}

function openEditModal(id) {
    const photo = photos.find(p => p.id === id);
    if (!photo) return;

    editingPhotoId = id;
    pendingImageData = null;
    document.getElementById("modal-title").textContent = "Edit Photo";
    document.getElementById("photo-title-input").value = photo.title;
    document.getElementById("photo-note-input").value = photo.note || "";
    selectedCategory = photo.category;
    renderModalChips();

    document.getElementById("drop-zone-prompt").classList.add("hidden");
    const previewContainer = document.getElementById("preview-container");
    previewContainer.classList.remove("hidden");
    document.getElementById("image-preview").src = photo.image;

    document.getElementById("photo-modal").classList.remove("hidden");
}

function closeModal() {
    document.getElementById("photo-modal").classList.add("hidden");
}

function handleFileSelect(file) {
    if (!file || !file.type.startsWith("image/")) {
        alert("Please select a valid image file.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        pendingImageData = e.target.result;
        document.getElementById("drop-zone-prompt").classList.add("hidden");
        const previewContainer = document.getElementById("preview-container");
        previewContainer.classList.remove("hidden");
        document.getElementById("image-preview").src = pendingImageData;
    };
    reader.readAsDataURL(file);
}

async function toggleFavorite(id) {
    const photo = photos.find(p => p.id === id);
    if (photo) {
        photo.favorite = !photo.favorite;
        await savePhotoToDB(photo);
        renderApp();
    }
}

function promptDelete(id) {
    photoToDeleteId = id;
    document.getElementById("confirm-modal").classList.remove("hidden");
}

// Backup & Restore
function exportBackup() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(photos, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `reason-gallery-backup-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

async function importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const imported = JSON.parse(event.target.result);
            if (Array.isArray(imported)) {
                photos = imported;
                const transaction = db.transaction(STORE_NAME, "readwrite");
                const store = transaction.objectStore(STORE_NAME);
                store.clear();
                for (const p of photos) {
                    store.put(p);
                }
                renderApp();
                alert("Backup successfully restored!");
            } else {
                alert("Invalid backup file format.");
            }
        } catch (err) {
            alert("Failed to parse JSON backup file.");
        }
    };
    reader.readAsText(file);
}

function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}