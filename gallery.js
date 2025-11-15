// Global state
let allImageFiles = [];
let currentImageFiles = [];
let currentFolder = 'All Files';
let rootFolderName = '';
let objectURLs = [];
let currentLightboxIndex = 0;

// Supported image formats
const SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff'];

// DOM Elements
const folderInput = document.getElementById('folderInput');
const gallery = document.getElementById('gallery');
const sidebarFolders = document.getElementById('sidebarFolders');
const folderTitle = document.getElementById('folderTitle');
const sortSelect = document.getElementById('sortSelect');
const connectBtn = document.getElementById('connectBtn');
const connectionStatus = document.getElementById('connectionStatus');
const connectedFolder = document.getElementById('connectedFolder');
const itemCount = document.getElementById('itemCount');
const totalSize = document.getElementById('totalSize');
const thumbnailSize = document.getElementById('thumbnailSize');
const loadingSpinner = document.getElementById('loadingSpinner');
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxFilename = document.getElementById('lightboxFilename');
const lightboxPosition = document.getElementById('lightboxPosition');
const zoomSlider = document.getElementById('zoomSlider');
const zoomLevel = document.getElementById('zoomLevel');

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
    setupEventListeners();
    setupDragAndDrop();
    setupSidebarResize();
}

// Event Listeners
function setupEventListeners() {
    connectBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleConnectDisconnect();
    });
    folderInput.addEventListener('change', handleFolderSelection);
    sortSelect.addEventListener('change', handleSort);
    thumbnailSize.addEventListener('input', handleThumbnailResize);
    
    // Lightbox controls
    document.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    document.querySelector('.lightbox-prev').addEventListener('click', showPrevImage);
    document.querySelector('.lightbox-next').addEventListener('click', showNextImage);
    zoomSlider.addEventListener('input', handleZoom);
    
    // Keyboard controls
    document.addEventListener('keydown', handleKeyboard);
}

// Connect/Disconnect Handler
function handleConnectDisconnect() {
    if (connectBtn.classList.contains('connected')) {
        // Disconnect
        handleClear();
        connectBtn.textContent = 'Connect';
        connectBtn.classList.remove('connected');
        connectionStatus.textContent = '';
        connectedFolder.textContent = 'None';
    } else {
        // Connect - open folder dialog
        folderInput.click();
    }
}

// File Handling
async function handleFolderSelection(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    await processFiles(files);
}

// Drag and Drop
function setupDragAndDrop() {
    document.body.addEventListener('dragover', (e) => {
        e.preventDefault();
        gallery.classList.add('drag-over');
    });
    
    document.body.addEventListener('dragleave', (e) => {
        // Only remove if leaving the window
        if (e.target === document.body) {
            gallery.classList.remove('drag-over');
        }
    });
    
    document.body.addEventListener('drop', async (e) => {
        e.preventDefault();
        gallery.classList.remove('drag-over');
        
        const items = e.dataTransfer.items;
        if (items) {
            const files = [];
            for (let i = 0; i < items.length; i++) {
                const item = items[i].webkitGetAsEntry();
                if (item) {
                    await traverseDirectory(item, '', files);
                }
            }
            if (files.length > 0) {
                await processFiles(files);
            }
        }
    });
}

async function traverseDirectory(item, path, files) {
    if (item.isFile) {
        return new Promise((resolve) => {
            item.file((file) => {
                const ext = '.' + file.name.split('.').pop().toLowerCase();
                if (SUPPORTED_FORMATS.includes(ext)) {
                    Object.defineProperty(file, 'webkitRelativePath', {
                        value: path + file.name,
                        writable: false
                    });
                    files.push(file);
                }
                resolve();
            });
        });
    } else if (item.isDirectory) {
        const dirReader = item.createReader();
        return new Promise((resolve) => {
            dirReader.readEntries(async (entries) => {
                for (const entry of entries) {
                    await traverseDirectory(entry, path + item.name + '/', files);
                }
                resolve();
            });
        });
    }
}

// Sidebar Resize
function setupSidebarResize() {
    const resizer = document.getElementById('resizer');
    const sidebar = document.getElementById('sidebar');
    let isResizing = false;
    
    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const newWidth = e.clientX;
        if (newWidth > 150 && newWidth < 400) {
            sidebar.style.width = newWidth + 'px';
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

// File Handling
async function handleFolderSelection(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    processFiles(files);
}

async function processFiles(files) {
    // Don't show loading yet - will show during renderGallery
    
    // Clear previous object URLs
    revokeAllObjectURLs();
    
    // Filter image files
    const imageFiles = files.filter(file => {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        return SUPPORTED_FORMATS.includes(ext);
    });
    
    if (imageFiles.length === 0) {
        showEmptyState();
        return;
    }
    
    // Extract root folder name
    if (imageFiles[0].webkitRelativePath) {
        rootFolderName = imageFiles[0].webkitRelativePath.split('/')[0];
        folderTitle.textContent = rootFolderName;
        // Update connected folder display
        connectedFolder.textContent = rootFolderName;
    } else {
        // For drag and drop without relative path, use a generic name
        rootFolderName = 'Selected Folder';
        folderTitle.textContent = rootFolderName;
        connectedFolder.textContent = rootFolderName;
    }
    
    allImageFiles = imageFiles;
    currentImageFiles = imageFiles;
    currentFolder = 'All Files';
    
    // Build sidebar
    buildSidebar();
    
    // Render gallery (this will show loading and wait for all images)
    await renderGallery();
    
    // Update button to show "Disconnect"
    connectBtn.textContent = 'Disconnect';
    connectBtn.classList.add('connected');
    
    // Update connection status in header
    const userName = 'macic';
    connectionStatus.textContent = `Connected as: ${userName}`;
}

function buildSidebar() {
    sidebarFolders.innerHTML = '';
    
    // Add "All Files" option
    const allFilesItem = createSidebarItem('All Files', allImageFiles.length);
    allFilesItem.classList.add('active');
    allFilesItem.addEventListener('click', () => handleFolderFilter('All Files'));
    sidebarFolders.appendChild(allFilesItem);
    
    // Extract unique folders
    const folders = {};
    allImageFiles.forEach(file => {
        if (file.webkitRelativePath) {
            const parts = file.webkitRelativePath.split('/');
            if (parts.length > 2) {
                const folderPath = parts.slice(0, -1).join('/');
                const folderName = parts[parts.length - 2];
                if (!folders[folderPath]) {
                    folders[folderPath] = {
                        name: folderName,
                        path: folderPath,
                        count: 0
                    };
                }
                folders[folderPath].count++;
            }
        }
    });
    
    // Add folder items
    Object.values(folders).forEach(folder => {
        const item = createSidebarItem(folder.name, folder.count);
        item.addEventListener('click', () => handleFolderFilter(folder.path));
        sidebarFolders.appendChild(item);
    });
}

function createSidebarItem(name, count) {
    const item = document.createElement('div');
    item.className = 'sidebar-item';
    item.dataset.folder = name;
    item.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 4a2 2 0 0 1 2-2h3.586a1 1 0 0 1 .707.293l1.414 1.414a1 1 0 0 0 .707.293H12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4z"/>
        </svg>
        <span>${name}</span>
        <span style="margin-left: auto; opacity: 0.5;">${count}</span>
    `;
    return item;
}

function handleFolderFilter(folderPath) {
    // Update active state
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    // Filter files
    if (folderPath === 'All Files') {
        currentImageFiles = allImageFiles;
        currentFolder = 'All Files';
    } else {
        currentImageFiles = allImageFiles.filter(file => {
            if (file.webkitRelativePath) {
                const fileFolderPath = file.webkitRelativePath.split('/').slice(0, -1).join('/');
                return fileFolderPath === folderPath;
            }
            return false;
        });
        currentFolder = folderPath;
    }
    
    // Re-render gallery
    renderGallery();
}

// Gallery Rendering
async function renderGallery() {
    // Clear gallery immediately and show loading
    gallery.innerHTML = '';
    showLoading();
    
    if (currentImageFiles.length === 0) {
        hideLoading();
        showEmptyState();
        updateStatusBar();
        return;
    }
    
    // Sort files
    const sortedFiles = sortFiles(currentImageFiles);
    
    // Create grid
    const gridContainer = document.createElement('div');
    gridContainer.className = 'gallery-grid';
    
    // Preload all images before showing any
    const imagePromises = sortedFiles.map((file, index) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const objectURL = URL.createObjectURL(file);
            objectURLs.push(objectURL);
            
            img.onload = () => resolve({ file, index, img, objectURL });
            img.onerror = reject;
            img.src = objectURL;
        });
    });
    
    try {
        // Wait for all images to load
        const loadedImages = await Promise.all(imagePromises);
        
        // Hide loading spinner
        hideLoading();
        
        // Create gallery items with already loaded images
        loadedImages.forEach(({ file, index, objectURL }) => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            
            const img = document.createElement('img');
            img.src = objectURL;
            img.alt = file.name;
            
            const name = document.createElement('div');
            name.className = 'gallery-item-name';
            name.textContent = file.name;
            
            item.appendChild(img);
            item.appendChild(name);
            
            item.addEventListener('click', () => openLightbox(index));
            
            gridContainer.appendChild(item);
        });
        
        gallery.appendChild(gridContainer);
        updateStatusBar();
        
    } catch (error) {
        console.error('Error loading images:', error);
        hideLoading();
        gallery.innerHTML = `
            <div class="empty-state">
                <p>Error loading some images</p>
            </div>
        `;
    }
}

function createGalleryItem(file, index) {
    // This function is no longer used - keeping for reference
    const item = document.createElement('div');
    item.className = 'gallery-item';
    
    const img = document.createElement('img');
    const objectURL = URL.createObjectURL(file);
    objectURLs.push(objectURL);
    
    img.src = objectURL;
    img.alt = file.name;
    img.loading = 'lazy';
    
    const name = document.createElement('div');
    name.className = 'gallery-item-name';
    name.textContent = file.name;
    
    item.appendChild(img);
    item.appendChild(name);
    
    item.addEventListener('click', () => openLightbox(index));
    
    return item;
}

function showEmptyState() {
    gallery.innerHTML = `
        <div class="empty-state">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="currentColor" opacity="0.3">
                <path d="M8 12a4 4 0 0 1 4-4h16l4 4h20a4 4 0 0 1 4 4v32a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V12z"/>
            </svg>
            <p>No images found in this folder</p>
        </div>
    `;
}

// Sorting
function sortFiles(files) {
    const sortBy = sortSelect.value;
    const sorted = [...files];
    
    switch (sortBy) {
        case 'name-asc':
            sorted.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'name-desc':
            sorted.sort((a, b) => b.name.localeCompare(a.name));
            break;
        case 'date-asc':
            sorted.sort((a, b) => a.lastModified - b.lastModified);
            break;
        case 'date-desc':
            sorted.sort((a, b) => b.lastModified - a.lastModified);
            break;
        case 'size-asc':
            sorted.sort((a, b) => a.size - b.size);
            break;
        case 'size-desc':
            sorted.sort((a, b) => b.size - a.size);
            break;
    }
    
    return sorted;
}

function handleSort() {
    renderGallery();
}

// Status Bar
function updateStatusBar() {
    const count = currentImageFiles.length;
    const totalBytes = currentImageFiles.reduce((sum, file) => sum + file.size, 0);
    
    itemCount.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
    totalSize.textContent = formatBytes(totalBytes);
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Thumbnail Resize
function handleThumbnailResize() {
    const size = thumbnailSize.value;
    document.documentElement.style.setProperty('--thumb-size', `${size}px`);
}

// Lightbox
function openLightbox(index) {
    currentLightboxIndex = index;
    const file = currentImageFiles[index];
    
    const objectURL = URL.createObjectURL(file);
    objectURLs.push(objectURL);
    
    lightboxImage.src = objectURL;
    lightboxFilename.textContent = file.name;
    lightboxPosition.textContent = `${index + 1} of ${currentImageFiles.length}`;
    
    lightbox.style.display = 'flex';
    zoomSlider.value = 100;
    zoomLevel.textContent = '100%';
    lightboxImage.style.transform = 'scale(1)';
}

function closeLightbox() {
    lightbox.style.display = 'none';
    URL.revokeObjectURL(lightboxImage.src);
    lightboxImage.src = '';
}

function showPrevImage() {
    if (currentLightboxIndex > 0) {
        URL.revokeObjectURL(lightboxImage.src);
        openLightbox(currentLightboxIndex - 1);
    }
}

function showNextImage() {
    if (currentLightboxIndex < currentImageFiles.length - 1) {
        URL.revokeObjectURL(lightboxImage.src);
        openLightbox(currentLightboxIndex + 1);
    }
}

function handleZoom() {
    const scale = zoomSlider.value / 100;
    lightboxImage.style.transform = `scale(${scale})`;
    zoomLevel.textContent = `${zoomSlider.value}%`;
}

// Keyboard Controls
function handleKeyboard(e) {
    if (lightbox.style.display === 'flex') {
        switch (e.key) {
            case 'Escape':
                closeLightbox();
                break;
            case 'ArrowLeft':
                showPrevImage();
                break;
            case 'ArrowRight':
                showNextImage();
                break;
        }
    }
}

// Clear
function handleClear() {
    // Revoke all object URLs
    revokeAllObjectURLs();
    
    // Clear state
    allImageFiles = [];
    currentImageFiles = [];
    currentFolder = 'All Files';
    rootFolderName = '';
    
    // Clear UI
    gallery.innerHTML = `
        <div class="empty-state">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="currentColor" opacity="0.3">
                <path d="M8 12a4 4 0 0 1 4-4h16l4 4h20a4 4 0 0 1 4 4v32a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V12z"/>
            </svg>
            <p>Drop a folder here or click "Select Folder" to begin</p>
        </div>
    `;
    sidebarFolders.innerHTML = '';
    folderTitle.textContent = 'Freeview';
    folderInput.value = '';
    
    updateStatusBar();
}

// Loading
function showLoading() {
    loadingSpinner.style.display = 'flex';
    setTimeout(() => {
        // Minimum display time
    }, 200);
}

function hideLoading() {
    loadingSpinner.style.display = 'none';
}

// Memory Management
function revokeAllObjectURLs() {
    objectURLs.forEach(url => URL.revokeObjectURL(url));
    objectURLs = [];
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    revokeAllObjectURLs();
});