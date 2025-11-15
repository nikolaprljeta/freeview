try {
    // --- DOM Element Caching ---
    const folderInput = document.getElementById('folderInput');
    const folderInputLabel = document.querySelector('.folder-input-label');
    const sidebar = document.getElementById('sidebar');
    const sidebarFoldersContainer = document.getElementById('sidebar-folders');
    const sidebarResizer = document.getElementById('sidebar-resizer');
    const mainContent = document.getElementById('main-content');
    const currentFolderTitle = document.getElementById('current-folder-title');
    const sortSelect = document.getElementById('sortSelect');
    const clearBtn = document.getElementById('clearBtn');
    const loadingIndicator = document.getElementById('loading');
    const galleryContainer = document.getElementById('gallery');
    const statusBar = document.getElementById('status-bar');
    const itemCountDisplay = document.getElementById('itemCount');
    const thumbnailSizeSlider = document.getElementById('thumbnailSizeSlider');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = lightbox.querySelector('img');
    const leftArrow = lightbox.querySelector('.arrow.left');
    const rightArrow = lightbox.querySelector('.arrow.right');
    const miniMapCanvas = document.getElementById('miniMap');
    const lightboxZoomSlider = document.getElementById('lightboxZoomSlider');
    const miniControlsContainer = document.getElementById('miniControls');
    const connectedFolderInfo = document.getElementById('connectedFolderInfo'); // Added reference

    // --- State Variables ---
    let allImages = [];
    let imagesByFolder = {};
    let currentFolder = 'All Files';
    let currentImagesList = [];
    let currentThumbnailSize = parseInt(thumbnailSizeSlider.value);

    // Lightbox state
    let lightboxScale = 1;
    let lightboxPosX = 0;
    let lightboxPosY = 0;
    let isLightboxDragging = false;
    let startX = 0;
    let startY = 0;
    let initialPosX = 0;
    let initialPosY = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let initialTouchDistance = 0;
    let initialLightboxScale = 1;
    let activeTouchPoints = [];

    let minimapUpdateTimeout;
    let currentIndex = 0;

    // --- Initialization ---
    window.addEventListener('DOMContentLoaded', () => {
        console.log('DOMContentLoaded fired.');
        // Initial setup of UI elements and event listeners
        renderSidebarStructure();
        setFolder('All Files'); // Load the default view
        applyThumbnailSize();
        setupEventListeners();
        registerServiceWorker();

        // Adjust layout and ensure proper scrolling
        adjustLayout();
        window.addEventListener('resize', adjustLayout);
    });

    // --- File Loading and Management ---

    function handleFileSelection(files) {
        console.log('Files selected in handleFileSelection:', files);
        if (!files || files.length === 0) {
            console.log('No files or empty selection in handleFileSelection.');
            return;
        }
        
        const validFiles = Array.from(files)
            .filter(f => {
                console.log(`Processing file in handleFileSelection: ${f.name}, Type: ${f.type}, RelativePath: ${f.webkitRelativePath}`);
                return f.type.startsWith('image/');
            })
            .map(f => {
                f.displayPath = f.webkitRelativePath || f.name;
                return f;
            });

        if (validFiles.length === 0) {
            console.log('No valid image files found in handleFileSelection.');
            alert('No image files were selected.');
            return;
        }
        console.log('Valid image files in handleFileSelection:', validFiles);
        loadFiles(validFiles);
    }

    function loadFiles(files) {
        console.log('Loading files in loadFiles:', files);
        loadingIndicator.style.display = 'block';
        galleryContainer.innerHTML = '';
        imagesByFolder = {};
        allImages = files;
        currentFolder = 'All Files';

        files.forEach(file => {
            let folderPath = 'All Files';
            if (file.displayPath && file.displayPath.includes('/')) {
                const parts = file.displayPath.split('/');
                parts.pop();
                folderPath = parts.join('/');
            }
            if (!imagesByFolder[folderPath]) {
                imagesByFolder[folderPath] = [];
            }
            imagesByFolder[folderPath].push(file);
        });

        console.log('Images organized by folder in loadFiles:', imagesByFolder);
        setFolder(currentFolder);
        renderSidebarStructure();
        loadingIndicator.style.display = 'none';
        folderInput.value = '';
    }

    function setFolder(folderName) {
        currentFolder = folderName;
        currentImagesList = folderName === 'All Files' ? allImages : imagesByFolder[folderName] || [];

        currentFolderTitle.textContent = folderName === 'All Files' ? 'All Files' : folderName.split('/').pop() || folderName;

        console.log(`Setting folder to: ${folderName}, Images to display in setFolder:`, currentImagesList);
        renderGallery(currentImagesList);
        renderSidebarStructure();
        updateStatusBar();
        
        // Update the connected folder info
        if (connectedFolderInfo) {
            connectedFolderInfo.textContent = `Connected to: ${folderName === 'All Files' ? 'All Files' : folderName.split('/').pop() || folderName}`;
        }
    }

    function renderGallery(images) {
        console.log('Rendering gallery with images:', images);
        galleryContainer.innerHTML = '';
        if (!images || images.length === 0) {
            galleryContainer.innerHTML = '<p class="empty-gallery-message">No images found.</p>';
            console.log('Gallery is empty.');
            return;
        }

        images.forEach((file, index) => {
            const container = document.createElement('div');
            container.className = 'image-container';
            container.style.maxWidth = `${currentThumbnailSize}px`;
            container.style.height = `${currentThumbnailSize}px`;

            const img = document.createElement('img');
            const objectUrl = URL.createObjectURL(file);
            img.src = objectUrl;
            img.alt = file.name;
            img.loading = 'lazy';

            img.onload = () => {
                console.log(`Image loaded successfully: ${file.name}`);
                URL.revokeObjectURL(objectUrl);
                container.dataset.width = img.naturalWidth;
                container.dataset.height = img.naturalHeight;
            };
            img.onerror = () => {
                console.error(`Failed to load image: ${file.name}`);
                URL.revokeObjectURL(objectUrl);
                container.innerHTML = '<p>Error loading.</p>';
            };

            container.appendChild(img);
            container.dataset.index = index;
            container.addEventListener('click', () => openLightbox(index, images));
            galleryContainer.appendChild(container);
        });
    }

    function applyThumbnailSize() {
        currentThumbnailSize = parseInt(thumbnailSizeSlider.value);
        const containers = galleryContainer.querySelectorAll('.image-container');
        containers.forEach(container => {
            container.style.maxWidth = `${currentThumbnailSize}px`;
            container.style.height = `${currentThumbnailSize}px`;
        });
    }

    // --- Sidebar Rendering and Resizing ---

    function renderSidebarStructure() {
        sidebarFoldersContainer.innerHTML = '';

        const allFilesFolder = createSidebarFolderElement('All Files', '🗀', 'All your images');
        allFilesFolder.classList.toggle('active', currentFolder === 'All Files');
        allFilesFolder.addEventListener('click', () => setFolder('All Files'));
        sidebarFoldersContainer.appendChild(allFilesFolder);

        Object.keys(imagesByFolder).sort().forEach(folderPath => {
            const folderName = folderPath.split('/').pop() || folderPath;
            const folder = createSidebarFolderElement(folderName, '🗀', `${imagesByFolder[folderPath].length} items`);
            folder.dataset.folderPath = folderPath;
            folder.classList.toggle('active', currentFolder === folderPath);
            folder.addEventListener('click', () => setFolder(folderPath));
            sidebarFoldersContainer.appendChild(folder);
        });
    }

    function createSidebarFolderElement(name, icon, subtitle) {
        const aTag = document.createElement('a');
        aTag.href = '#';
        aTag.classList.add('sidebar-item');
        if (name === 'All Files') aTag.classList.add('active'); // Ensure 'All Files' is active by default

        const iconSpan = document.createElement('span');
        iconSpan.classList.add('sidebar-icon');
        iconSpan.textContent = icon;
        aTag.appendChild(iconSpan);

        const textContentDiv = document.createElement('div');
        textContentDiv.classList.add('sidebar-text-content');

        const titleSpan = document.createElement('span');
        titleSpan.classList.add('sidebar-title');
        titleSpan.textContent = name;
        titleSpan.title = name;
        textContentDiv.appendChild(titleSpan);

        const subtitleSpan = document.createElement('span');
        subtitleSpan.classList.add('sidebar-subtitle');
        subtitleSpan.textContent = subtitle;
        textContentDiv.appendChild(subtitleSpan);

        aTag.appendChild(textContentDiv);
        return aTag;
    }

    // Sidebar resizer logic
    let isResizing = false;
    let startDragX = 0;
    let sidebarWidth = 250;

    sidebarResizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isResizing = true;
        startDragX = e.clientX;
        sidebarWidth = sidebar.offsetWidth;
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const deltaX = e.clientX - startDragX;
        const newWidth = sidebarWidth + deltaX;
        const minSidebarWidth = 100;
        const maxSidebarWidth = 500;
        const clampedWidth = Math.max(minSidebarWidth, Math.min(maxSidebarWidth, newWidth));
        sidebar.style.width = `${clampedWidth}px`;
        adjustLayout();
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });

    // --- Layout Adjustment ---
    function adjustLayout() {
        const currentSidebarWidth = sidebar.offsetWidth;
        const viewportWidth = window.innerWidth;
        const mainContentMinWidth = 300;
        const calculatedMainWidth = viewportWidth - currentSidebarWidth;
        mainContent.style.width = `${Math.max(mainContentMinWidth, calculatedMainWidth)}px`;
    }

    // --- Status Bar Update ---
    function updateStatusBar() {
        const totalBytes = currentImagesList.reduce((sum, file) => sum + file.size, 0);
        let formattedSize;
        if (totalBytes < 1024) {
            formattedSize = `${totalBytes} Bytes`;
        } else if (totalBytes < 1024 * 1024) {
            formattedSize = `${(totalBytes / 1024).toFixed(2)} KB`;
        } else {
            formattedSize = `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
        }
        itemCountDisplay.textContent = `${currentImagesList.length} Items, ${formattedSize}`;
    }

    // --- Lightbox Functionality ---

    function openLightbox(index, imagesArray) {
        currentIndex = index;
        currentImagesList = imagesArray;
        lightbox.style.display = 'flex';

        const file = imagesArray[index];
        const reader = new FileReader();
        reader.onload = (e) => {
            lightboxImg.src = e.target.result;
            lightboxImg.onload = () => {
                resetLightboxTransform();
                lightboxZoomSlider.value = lightboxScale;
                applyLightboxTransform();
                fitImageToScreen();
                updateMiniMap();
            };
            lightboxImg.onerror = () => {
                console.error(`Lightbox failed to load image: ${file.name}`);
                lightbox.style.display = 'none';
            };
        };
        reader.onerror = () => {
            console.error(`File reader error for ${file.name}`);
            lightbox.style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    function closeLightbox() {
        lightbox.style.display = 'none';
        lightboxImg.src = '';
        resetLightboxTransform();
        clearTimeout(minimapUpdateTimeout);
    }

    function resetLightboxTransform() {
        lightboxScale = 1;
        lightboxPosX = 0;
        lightboxPosY = 0;
        isLightboxDragging = false;
        activeTouchPoints = [];
        lightboxImg.style.cursor = 'grab';
    }

    function fitImageToScreen() {
        if (!lightboxImg.naturalWidth || !lightboxImg.naturalHeight) return;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const imgWidth = lightboxImg.naturalWidth;
        const imgHeight = lightboxImg.naturalHeight;

        const scaleX = (viewportWidth * 0.9) / imgWidth;
        const scaleY = (viewportHeight * 0.9) / imgHeight;

        lightboxScale = Math.min(scaleX, scaleY);
        lightboxPosX = 0;
        lightboxPosY = 0;

        lightboxZoomSlider.value = lightboxScale;
        applyLightboxTransform();
    }

    function applyLightboxTransform() {
        const imgWidth = lightboxImg.naturalWidth * lightboxScale;
        const imgHeight = lightboxImg.naturalHeight * lightboxScale;
        const viewportWidth = window.innerWidth * 0.9;
        const viewportHeight = window.innerHeight * 0.9;

        const maxX = Math.max(0, (imgWidth - viewportWidth) / 2);
        const maxY = Math.max(0, (imgHeight - viewportHeight) / 2);

        lightboxPosX = Math.max(-maxX, Math.min(maxX, lightboxPosX));
        lightboxPosY = Math.max(-maxY, Math.min(maxY, lightboxPosY));

        lightboxImg.style.transform = `translate(${lightboxPosX}px, ${lightboxPosY}px) scale(${lightboxScale})`;
        updateMiniMap();
    }

    function showNextImage() {
        if (currentImagesList.length === 0) return;
        currentIndex = (currentIndex + 1) % currentImagesList.length;
        openLightbox(currentIndex, currentImagesList);
    }

    function showPrevImage() {
        if (currentImagesList.length === 0) return;
        currentIndex = (currentIndex - 1 + currentImagesList.length) % currentImagesList.length;
        openLightbox(currentIndex, currentImagesList);
    }

    // --- Minimap Handling ---

    function updateMiniMap() {
        const ctx = miniMapCanvas.getContext('2d');
        if (!lightboxImg.naturalWidth || !lightboxImg.naturalHeight || !ctx) return;

        const imgAspect = lightboxImg.naturalWidth / lightboxImg.naturalHeight;
        const canvasMaxWidth = 150;
        const canvasMaxHeight = 100;

        let canvasWidth, canvasHeight;
        if (imgAspect > canvasMaxWidth / canvasMaxHeight) {
            canvasWidth = canvasMaxWidth;
            canvasHeight = canvasMaxWidth / imgAspect;
        } else {
            canvasHeight = canvasMaxHeight;
            canvasWidth = canvasMaxHeight * imgAspect;
        }

        miniMapCanvas.width = canvasWidth;
        miniMapCanvas.height = canvasHeight;

        ctx.drawImage(lightboxImg, 0, 0, canvasWidth, canvasHeight);

        const scaledImgWidth = lightboxImg.naturalWidth * lightboxScale;
        const scaledImgHeight = lightboxImg.naturalHeight * lightboxScale;

        const viewRectWidth = (window.innerWidth * 0.9 / scaledImgWidth) * canvasWidth;
        const viewRectHeight = (window.innerHeight * 0.9 / scaledImgHeight) * canvasHeight;

        const viewRectX = (canvasWidth / 2) - (viewRectWidth / 2) - (lightboxPosX / scaledImgWidth) * canvasWidth;
        const viewRectY = (canvasHeight / 2) - (viewRectHeight / 2) - (lightboxPosY / scaledImgHeight) * canvasHeight;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(viewRectX, viewRectY, viewRectWidth, viewRectHeight);
    }

    function updatePanFromMinimap(clickX, clickY) {
        const canvasWidth = miniMapCanvas.width;
        const canvasHeight = miniMapCanvas.height;

        if (!canvasWidth || !canvasHeight) return;

        const normalizedX = clickX / canvasWidth;
        const normalizedY = clickY / canvasHeight;

        const scaledImgWidth = lightboxImg.naturalWidth * lightboxScale;
        const scaledImgHeight = lightboxImg.naturalHeight * lightboxScale;

        lightboxPosX = (0.5 - normalizedX) * scaledImgWidth;
        lightboxPosY = (0.5 - normalizedY) * scaledImgHeight;

        applyLightboxTransform();
    }

    // --- Event Listeners Setup ---

    function setupEventListeners() {
        folderInputLabel.addEventListener('click', () => folderInput.click());
        folderInput.addEventListener('change', (e) => handleFileSelection(e.target.files));

        mainContent.addEventListener('dragover', (e) => {
            e.preventDefault();
            mainContent.classList.add('drag-over');
        });
        mainContent.addEventListener('dragleave', () => {
            mainContent.classList.remove('drag-over');
        });
        mainContent.addEventListener('drop', async (e) => {
            e.preventDefault();
            mainContent.classList.remove('drag-over');
            if (e.dataTransfer.items) {
                const items = Array.from(e.dataTransfer.items);
                let droppedFiles = [];
                for (const item of items) {
                    const entry = item.webkitGetAsEntry();
                    if (entry) {
                        try {
                            const files = await traverseFileTree(entry);
                            droppedFiles.push(...files);
                        } catch (error) {
                            console.error("Error traversing file tree:", error);
                        }
                    }
                }
                handleFileSelection(droppedFiles);
            }
        });

        sortSelect.addEventListener('change', () => {
            setFolder(currentFolder);
        });

        clearBtn.addEventListener('click', () => {
            if (lightbox.style.display === 'flex') {
                closeLightbox();
            }

            allImages = [];
            imagesByFolder = {};
            currentFolder = 'All Files';
            currentImagesList = [];
            galleryContainer.innerHTML = '';
            renderSidebarStructure();
            currentFolderTitle.textContent = 'All Files';
            itemCountDisplay.textContent = '0 Items, 0 KB';
            folderInput.value = '';

            if (window.gc) {
                window.gc();
            }
        });

        thumbnailSizeSlider.addEventListener('input', applyThumbnailSize);

        leftArrow.addEventListener('click', showPrevImage);
        rightArrow.addEventListener('click', showNextImage);
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                closeLightbox();
            }
        });
        lightboxImg.addEventListener('click', (e) => e.stopPropagation());

        lightboxImg.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isLightboxDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialPosX = lightboxPosX;
            initialPosY = lightboxPosY;
            lightboxImg.style.cursor = 'grabbing';
        });
        document.addEventListener('mousemove', (e) => {
            if (!isLightboxDragging) return;
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            lightboxPosX = initialPosX + deltaX;
            lightboxPosY = initialPosY + deltaY;
            applyLightboxTransform();
        });
        document.addEventListener('mouseup', () => {
            isLightboxDragging = false;
            lightboxImg.style.cursor = 'grab';
        });

        lightboxImg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomIntensity = 0.1;
            const delta = e.deltaY > 0 ? -zoomIntensity : zoomIntensity;

            const oldScale = lightboxScale;
            lightboxScale = Math.max(0.5, Math.min(5, lightboxScale + delta));

            const mouseXRelativeToCenter = e.clientX - window.innerWidth / 2;
            const mouseYRelativeToCenter = e.clientY - window.innerHeight / 2;

            const scaleChangeRatio = lightboxScale / oldScale;
            lightboxPosX = mouseXRelativeToCenter + (lightboxPosX - mouseXRelativeToCenter) * scaleChangeRatio;
            lightboxPosY = mouseYRelativeToCenter + (lightboxPosY - mouseXRelativeToCenter) * scaleChangeRatio;

            lightboxZoomSlider.value = lightboxScale;
            applyLightboxTransform();
        });

        let lastTapTime = 0;

        lightboxImg.addEventListener('touchstart', (e) => {
            e.preventDefault();

            if (e.touches.length === 1) {
                const now = Date.now();
                if (now - lastTapTime < 300) {
                    fitImageToScreen();
                    lastTapTime = 0;
                    return;
                }
                lastTapTime = now;

                isLightboxDragging = true;
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                initialPosX = lightboxPosX;
                initialPosY = lightboxPosY;
            } else if (e.touches.length === 2) {
                isLightboxDragging = false;
                initialTouchDistance = getDistance(e.touches);
                initialLightboxScale = lightboxScale;

                const center = getTouchCenter(e.touches);
                startX = center.x;
                startY = center.y;
                initialPosX = lightboxPosX;
                initialPosY = lightboxPosY;
                activeTouchPoints = Array.from(e.touches);
            }
        });

        lightboxImg.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (isLightboxDragging && e.touches.length === 1) {
                const touch = e.touches[0];
                const deltaX = touch.clientX - touchStartX;
                const deltaY = touch.clientY - touchStartY;
                lightboxPosX = initialPosX + deltaX;
                lightboxPosY = initialPosY + deltaY;
                applyLightboxTransform();
            } else if (e.touches.length === 2) {
                const currentTouchDistance = getDistance(e.touches);
                const scaleChangeRatio = currentTouchDistance / initialTouchDistance;
                lightboxScale = Math.max(0.5, Math.min(5, initialLightboxScale * scaleChangeRatio));

                const currentCenter = getTouchCenter(e.touches);
                const deltaX = currentCenter.x - startX;
                const deltaY = currentCenter.y - startY;
                lightboxPosX = initialPosX + deltaX;
                lightboxPosY = initialPosY + deltaY;

                lightboxZoomSlider.value = lightboxScale;
                applyLightboxTransform();
                activeTouchPoints = Array.from(e.touches);
            }
        });

        lightboxImg.addEventListener('touchend', (e) => {
            if (e.touches.length === 1) {
                isLightboxDragging = true;
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                initialPosX = lightboxPosX;
                initialPosY = lightboxPosY;
                activeTouchPoints = Array.from(e.touches);
            } else {
                isLightboxDragging = false;
                activeTouchPoints = [];
            }
        });

        lightboxZoomSlider.addEventListener('input', (e) => {
            e.stopPropagation();
            lightboxScale = parseFloat(e.target.value);
            applyLightboxTransform();
        });

        miniMapCanvas.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const rect = miniMapCanvas.getBoundingClientRect();
            updatePanFromMinimap(e.clientX - rect.left, e.clientY - rect.top);
        });
         miniMapCanvas.addEventListener('mousemove', (e) => {
            e.stopPropagation();
            if(e.buttons === 1) {
                const rect = miniMapCanvas.getBoundingClientRect();
                updatePanFromMinimap(e.clientX - rect.left, e.clientY - rect.top);
            }
        });

        miniMapCanvas.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const rect = miniMapCanvas.getBoundingClientRect();
            const touch = e.touches[0];
            updatePanFromMinimap(touch.clientX - rect.left, touch.clientY - rect.top);
        });
         miniMapCanvas.addEventListener('touchmove', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const rect = miniMapCanvas.getBoundingClientRect();
            const touch = e.touches[0];
            updatePanFromMinimap(touch.clientX - rect.left, touch.clientY - rect.top);
        });

        document.addEventListener('keydown', (e) => {
            if (lightbox.style.display !== 'flex') return;

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                showPrevImage();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                showNextImage();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeLightbox();
            } else if (e.key === ' ') { 
                e.preventDefault();
                fitImageToScreen();
            }
        });
    }

    // --- File Tree Traversal for Drag and Drop ---

    async function traverseFileTree(fileEntry) {
        const files = [];
        if (fileEntry.isFile) {
            return new Promise(resolve => {
                fileEntry.file((file) => {
                    file.displayPath = fileEntry.fullPath.startsWith('/') ? fileEntry.fullPath.substring(1) : fileEntry.fullPath;
                    resolve([file]);
                }, (error) => console.error(`Error getting file: ${error}`);
            });
        } else if (fileEntry.isDirectory) {
            const directoryReader = fileEntry.createReader();
            let entries = [];
            try {
                entries = await readDirectoryEntries(directoryReader);
                for (const entry of entries) {
                    const subFiles = await traverseFileTree(entry);
                    files.push(...subFiles);
                }
            } catch (error) {
                console.error(`Error reading directory ${fileEntry.name}: ${error}`);
            }
            return files;
        }
        return files;
    }

    function readDirectoryEntries(directoryReader) {
        return new Promise((resolve, reject) => {
            directoryReader.readEntries((entries) => {
                if (!entries || entries.length === 0) {
                    resolve([]);
                } else {
                    resolve(entries);
                }
            }, reject);
        });
    }

    // --- Service Worker Registration ---

    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                        console.log('Service Worker registered with scope:', registration.scope);

                        registration.addEventListener('updatefound', () => {
                            const installingWorker = registration.installing;
                            installingWorker.addEventListener('statechange', () => {
                                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    if (confirm('New version of Freeview is available. Reload to update?')) {
                                        installingWorker.postMessage({ type: 'SKIP_WAITING' });
                                        window.location.reload();
                                    }
                                }
                            });
                        });
                    })
                    .catch(error => {
                        console.log('Service Worker registration failed:', error);
                    });
            });
        }
    }

} catch (error) {
    console.error('An error occurred during gallery.js execution:', error);
}

console.log('gallery.js script execution finished (or caught an error).');