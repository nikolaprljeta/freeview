const folderInput = document.getElementById('folderInput');
const gallery = document.getElementById('gallery');
const sidebar = document.getElementById('sidebar');
const loading = document.getElementById('loading');
const lightbox = document.getElementById('lightbox');
const lightboxImg = lightbox.querySelector('img');
const leftArrow = lightbox.querySelector('.arrow.left');
const rightArrow = lightbox.querySelector('.arrow.right');
const sortSelect = document.getElementById('sortSelect');
const main = document.getElementById('main');
const clearBtn = document.getElementById('clearBtn');
const zoomSlider = document.getElementById('zoomSlider');
const miniMap = document.getElementById('miniMap');
const titleElement = document.querySelector('#mainHeader h1');

let allImages = [];
let imagesByFolder = {};
let currentFolder = 'All Files';
let currentIndex = 0;
let currentImagesList = [];

// Lightbox state
let scale = 1;
let posX = 0;
let posY = 0;
let isDragging = false;
let startX = 0;
let startY = 0;
let initialPosX = 0;
let initialPosY = 0;

// Touch state
let initialDistance = 0;
let initialScale = 1;

// ---------- Prevent lightbox controls from closing ----------
zoomSlider.addEventListener('mousedown', e => e.stopPropagation());
zoomSlider.addEventListener('touchstart', e => e.stopPropagation());
zoomSlider.addEventListener('click', e => e.stopPropagation());
leftArrow.addEventListener('click', e => e.stopPropagation());
rightArrow.addEventListener('click', e => e.stopPropagation());

// ---------- Helper Functions ----------
// Throttle minimap updates for performance
let minimapUpdateTimeout;
function applyTransform() {
  // Apply reasonable bounds to prevent infinite panning
  const maxPan = Math.max(window.innerWidth, window.innerHeight) * 2;
  posX = Math.max(-maxPan, Math.min(maxPan, posX));
  posY = Math.max(-maxPan, Math.min(maxPan, posY));
  
  lightboxImg.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
  
  // Throttle minimap updates to improve performance
  clearTimeout(minimapUpdateTimeout);
  minimapUpdateTimeout = setTimeout(updateMiniMap, 16); // ~60fps
}

function fitImageToScreen() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const imgWidth = lightboxImg.naturalWidth;
  const imgHeight = lightboxImg.naturalHeight;
  
  if (!imgWidth || !imgHeight) return;
  
  // Calculate scale to fit image within 90% of viewport
  const scaleX = (viewportWidth * 0.9) / imgWidth;
  const scaleY = (viewportHeight * 0.9) / imgHeight;
  scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%
  
  // Center the image
  posX = 0;
  posY = 0;
  
  zoomSlider.value = scale;
  applyTransform();
}

function sortImages(imgArray) {
  const val = sortSelect.value;
  let sorted = [...imgArray];
  switch(val){
    case 'newest': sorted.sort((a,b) => b.lastModified - a.lastModified); break;
    case 'oldest': sorted.sort((a,b) => a.lastModified - b.lastModified); break;
    case 'name-asc': sorted.sort((a,b) => a.name.localeCompare(b.name)); break;
    case 'name-desc': sorted.sort((a,b) => b.name.localeCompare(a.name)); break;
    case 'size-asc': sorted.sort((a,b) => a.size - b.size); break;
    case 'size-desc': sorted.sort((a,b) => b.size - a.size); break;
  }
  return sorted;
}

// ---------- Sidebar ----------
function renderSidebar() {
  sidebar.innerHTML = '';
  const allBtn = document.createElement('h2');
  allBtn.textContent = 'All Files';
  allBtn.classList.toggle('active', currentFolder === 'All Files');
  allBtn.addEventListener('click', () => { setFolder('All Files'); });
  sidebar.appendChild(allBtn);

  Object.keys(imagesByFolder).sort().forEach(folder => {
    const h = document.createElement('h2');
    // Extract just the folder name from the full path
    const folderName = folder.split('/').pop() || folder;
    h.textContent = folderName;
    h.classList.toggle('active', currentFolder === folder);
    h.addEventListener('click', () => { setFolder(folder); });
    sidebar.appendChild(h);
  });
}

function setFolder(folder){
  currentFolder = folder;
  
  // Update title based on current folder
  if (folder === 'All Files') {
    titleElement.textContent = 'All Files';
  } else {
    // Extract just the folder name from the full path
    const folderName = folder.split('/').pop() || folder;
    titleElement.textContent = folderName;
  }
  
  gallery.innerHTML = '';
  let imgs = folder === 'All Files' ? allImages : imagesByFolder[folder];
  if(!imgs) return;
  imgs = sortImages(imgs);
  imgs.forEach((file, index) => {
    const container = document.createElement('div');
    container.className = 'image-container';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = file.name;
    img.loading = 'lazy';
    img.onload = () => URL.revokeObjectURL(img.src);
    container.appendChild(img);
    container.addEventListener('click', () => openLightbox(index, imgs));
    gallery.appendChild(container);
  });
  renderSidebar();
  folderInput.style.display = allImages.length ? 'none' : 'block';
}

// ---------- Lightbox Functions ----------
function openLightbox(index, imagesArr) {
  currentIndex = index;
  currentImagesList = imagesArr;
  lightbox.style.display = 'flex';
  
  const file = imagesArr[index];
  
  // Clean up previous data URL to prevent memory leak
  if (lightboxImg.src && lightboxImg.src.startsWith('data:')) {
    lightboxImg.src = '';
  }
  
  const reader = new FileReader();
  reader.onload = e => {
    lightboxImg.src = e.target.result;
    lightboxImg.onload = () => {
      fitImageToScreen();
    };
  };
  reader.readAsDataURL(file);
}

function closeLightbox() {
  lightbox.style.display = 'none';
  
  // Clean up data URL to prevent memory leak
  if (lightboxImg.src && lightboxImg.src.startsWith('data:')) {
    lightboxImg.src = '';
  }
  
  resetTransform();
}

function resetTransform() {
  scale = 1;
  posX = 0;
  posY = 0;
  isDragging = false;
}

function showNext() {
  if (currentImagesList.length === 0) return;
  currentIndex = (currentIndex + 1) % currentImagesList.length;
  openLightbox(currentIndex, currentImagesList);
}

function showPrev() {
  if (currentImagesList.length === 0) return;
  currentIndex = (currentIndex - 1 + currentImagesList.length) % currentImagesList.length;
  openLightbox(currentIndex, currentImagesList);
}

// ---------- Mouse Events ----------
lightboxImg.addEventListener('mousedown', e => {
  e.preventDefault();
  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;
  initialPosX = posX;
  initialPosY = posY;
  lightboxImg.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', e => {
  if (!isDragging) return;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  posX = initialPosX + dx;
  posY = initialPosY + dy;
  applyTransform();
});

document.addEventListener('mouseup', () => {
  isDragging = false;
  lightboxImg.style.cursor = 'grab';
});

// ---------- Mouse Wheel Zoom ----------
lightboxImg.addEventListener('wheel', e => {
  e.preventDefault();
  
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const oldScale = scale;
  scale = Math.max(0.5, Math.min(5, scale * delta));
  
  // Get mouse position relative to viewport
  const mouseX = e.clientX - window.innerWidth / 2;
  const mouseY = e.clientY - window.innerHeight / 2;
  
  // Adjust position to zoom toward mouse cursor
  const scaleChange = scale / oldScale;
  posX = mouseX + (posX - mouseX) * scaleChange;
  posY = mouseY + (posY - mouseY) * scaleChange;
  
  zoomSlider.value = scale;
  applyTransform();
});

// ---------- Touch Events ----------
function getDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getCenter(touches) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2
  };
}

let lastTap = 0;

lightboxImg.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    const now = Date.now();
    if (now - lastTap < 300) {
      // Double tap detected
      e.preventDefault();
      fitImageToScreen();
      lastTap = 0;
      return;
    }
    lastTap = now;
    
    isDragging = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    initialPosX = posX;
    initialPosY = posY;
  } else if (e.touches.length === 2) {
    e.preventDefault();
    isDragging = false;
    initialDistance = getDistance(e.touches);
    initialScale = scale;
    const center = getCenter(e.touches);
    startX = center.x;
    startY = center.y;
    initialPosX = posX;
    initialPosY = posY;
  }
});

lightboxImg.addEventListener('touchmove', e => {
  e.preventDefault();
  
  if (e.touches.length === 1 && isDragging) {
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    posX = initialPosX + dx;
    posY = initialPosY + dy;
    applyTransform();
  } else if (e.touches.length === 2) {
    const currentDistance = getDistance(e.touches);
    const scaleChange = currentDistance / initialDistance;
    scale = Math.max(0.5, Math.min(5, initialScale * scaleChange));
    
    const center = getCenter(e.touches);
    const dx = center.x - startX;
    const dy = center.y - startY;
    posX = initialPosX + dx;
    posY = initialPosY + dy;
    
    zoomSlider.value = scale;
    applyTransform();
  }
});

lightboxImg.addEventListener('touchend', e => {
  if (e.touches.length === 0) {
    isDragging = false;
    initialDistance = 0;
  } else if (e.touches.length === 1) {
    // Continue with single touch
    isDragging = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    initialPosX = posX;
    initialPosY = posY;
  }
});

// ---------- Zoom Slider ----------
zoomSlider.addEventListener('input', e => {
  e.stopPropagation();
  scale = parseFloat(e.target.value);
  applyTransform();
});

zoomSlider.addEventListener('change', e => {
  e.stopPropagation();
});

// ---------- Keyboard Navigation ----------
document.addEventListener('keydown', e => {
  if (lightbox.style.display !== 'flex') return;
  
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    showPrev();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    showNext();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeLightbox();
  }
});

// ---------- Lightbox Click to Close ----------
lightbox.addEventListener('click', e => {
  if (e.target === lightbox) {
    closeLightbox();
  }
});

lightboxImg.addEventListener('click', e => {
  e.stopPropagation();
});

// ---------- Arrow Navigation ----------
leftArrow.addEventListener('click', showPrev);
rightArrow.addEventListener('click', showNext);

// ---------- Mini-map ----------
let minimapDragging = false;

miniMap.addEventListener('mousedown', e => {
  e.stopPropagation();
  minimapDragging = true;
  updatePanFromMinimap(e.offsetX, e.offsetY);
});

miniMap.addEventListener('mousemove', e => {
  if (!minimapDragging) return;
  e.stopPropagation();
  updatePanFromMinimap(e.offsetX, e.offsetY);
});

miniMap.addEventListener('mouseup', e => {
  e.stopPropagation();
  minimapDragging = false;
});

miniMap.addEventListener('mouseleave', () => {
  minimapDragging = false;
});

miniMap.addEventListener('touchstart', e => {
  e.stopPropagation();
  e.preventDefault();
  minimapDragging = true;
  const rect = miniMap.getBoundingClientRect();
  const touch = e.touches[0];
  updatePanFromMinimap(touch.clientX - rect.left, touch.clientY - rect.top);
});

miniMap.addEventListener('touchmove', e => {
  if (!minimapDragging) return;
  e.stopPropagation();
  e.preventDefault();
  const rect = miniMap.getBoundingClientRect();
  const touch = e.touches[0];
  updatePanFromMinimap(touch.clientX - rect.left, touch.clientY - rect.top);
});

miniMap.addEventListener('touchend', e => {
  e.stopPropagation();
  e.preventDefault();
  minimapDragging = false;
});

function updatePanFromMinimap(clickX, clickY) {
  const canvasWidth = miniMap.width;
  const canvasHeight = miniMap.height;
  const scaledImgWidth = lightboxImg.naturalWidth * scale;
  const scaledImgHeight = lightboxImg.naturalHeight * scale;
  
  // Convert click position to normalized coordinates (0 to 1)
  const normalizedX = clickX / canvasWidth;
  const normalizedY = clickY / canvasHeight;
  
  // Calculate target position (center the clicked point)
  posX = -(normalizedX - 0.5) * scaledImgWidth;
  posY = -(normalizedY - 0.5) * scaledImgHeight;
  
  applyTransform();
}

function updateMiniMap() {
  const ctx = miniMap.getContext('2d');
  if (!lightboxImg.naturalWidth || !lightboxImg.naturalHeight) return;
  
  const imgAspect = lightboxImg.naturalWidth / lightboxImg.naturalHeight;
  
  // Calculate canvas size to match image aspect ratio
  const maxWidth = 150;
  const maxHeight = 100;
  let canvasWidth, canvasHeight;
  
  if (imgAspect > maxWidth / maxHeight) {
    canvasWidth = maxWidth;
    canvasHeight = maxWidth / imgAspect;
  } else {
    canvasHeight = maxHeight;
    canvasWidth = maxHeight * imgAspect;
  }
  
  // Set canvas size (this clears the canvas)
  miniMap.width = canvasWidth;
  miniMap.height = canvasHeight;
  
  // Draw the full image scaled to fit canvas
  ctx.drawImage(lightboxImg, 0, 0, canvasWidth, canvasHeight);
  
  // Calculate viewport rectangle
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scaledImgWidth = lightboxImg.naturalWidth * scale;
  const scaledImgHeight = lightboxImg.naturalHeight * scale;
  
  // Size of viewport relative to scaled image
  const viewRectWidth = (viewportWidth / scaledImgWidth) * canvasWidth;
  const viewRectHeight = (viewportHeight / scaledImgHeight) * canvasHeight;
  
  // Position of viewport (accounting for pan)
  const viewRectX = (canvasWidth / 2) - (viewRectWidth / 2) - (posX / scaledImgWidth) * canvasWidth;
  const viewRectY = (canvasHeight / 2) - (viewRectHeight / 2) - (posY / scaledImgHeight) * canvasHeight;
  
  // Draw viewport rectangle
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 2;
  ctx.strokeRect(viewRectX, viewRectY, viewRectWidth, viewRectHeight);
}

// ---------- Folder Input ----------
function handleFiles(files) {
  if (!files.length) return;
  loadFiles(files);
}

folderInput.addEventListener('change', e => {
  const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
  files.forEach(f => {
    if (!f.relativePath) f.relativePath = f.webkitRelativePath || f.name;
  });
  handleFiles(files);
});

// ---------- Drag & Drop ----------
function traverseFileTree(item, path = '') {
  return new Promise(resolve => {
    if (item.isFile) {
      item.file(file => {
        file.relativePath = path + file.name;
        resolve([file]);
      });
    } else if (item.isDirectory) {
      const dirReader = item.createReader();
      dirReader.readEntries(async entries => {
        const allFiles = [];
        for (const e of entries) {
          const subFiles = await traverseFileTree(e, path + item.name + '/');
          allFiles.push(...subFiles);
        }
        resolve(allFiles);
      });
    }
  });
}

main.addEventListener('dragover', e => {
  e.preventDefault();
  main.classList.add('drag-over');
  
  // Force dark mode styling if needed
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    main.style.backgroundColor = '#2a2a2a';
    main.style.border = '3px dashed #666';
  }
});

main.addEventListener('dragleave', () => {
  main.classList.remove('drag-over');
  // Clean up inline styles
  main.style.backgroundColor = '';
  main.style.border = '';
});

main.addEventListener('drop', async e => {
  e.preventDefault();
  main.classList.remove('drag-over');
  // Clean up inline styles
  main.style.backgroundColor = '';
  main.style.border = '';
  const items = [...e.dataTransfer.items];
  let files = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry();
    if (entry) {
      const folderFiles = await traverseFileTree(entry);
      files.push(...folderFiles);
    }
  }
  files = files.filter(f => f.type.startsWith('image/'));
  handleFiles(files);
});

// ---------- Clear ----------
clearBtn.addEventListener('click', () => {
  // Close lightbox and cleanup if open
  if (lightbox.style.display === 'flex') {
    closeLightbox();
  }
  
  // Clear timeouts to prevent memory leaks
  clearTimeout(minimapUpdateTimeout);
  
  allImages = [];
  imagesByFolder = {};
  currentFolder = 'All Files';
  currentImagesList = [];
  gallery.innerHTML = '';
  sidebar.innerHTML = '';
  folderInput.value = '';
  folderInput.style.display = 'block';
  titleElement.textContent = 'Gallery';
  
  // Force garbage collection hint (if available)
  if (window.gc) {
    window.gc();
  }
});

// ---------- Sort Select ----------
sortSelect.addEventListener('change', () => {
  setFolder(currentFolder);
});

// ---------- Load Files ----------
function loadFiles(files) {
  loading.style.display = 'block';
  gallery.innerHTML = '';
  sidebar.innerHTML = '';
  allImages = files;
  imagesByFolder = {};

  files.forEach(f => {
    let folder = 'Root';
    if (f.relativePath && f.relativePath.includes('/')) {
      const parts = f.relativePath.split('/');
      parts.pop();
      folder = parts.join('/');
    }
    if (!imagesByFolder[folder]) imagesByFolder[folder] = [];
    imagesByFolder[folder].push(f);
  });

  setFolder('All Files');
  loading.style.display = 'none';
}