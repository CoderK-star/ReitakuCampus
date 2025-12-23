// map2.js - Clean implementation of Reitaku University Map

// Configuration
const CONFIG = {
    center: [139.955303, 35.833707], // Reitaku University
    zoom: 10.25,
    pitch: 0,
    bearing: 0
};


// Category configuration with colors
const CATEGORIES = {
    "イベント": { color: "#e74c3c", label: "Events" },
    "体験": { color: "#f1c40f", label: "Activities" },
    "展示": { color: "#3498db", label: "Exhibitions" },
    "食べ物": { color: "#ff9800", label: "Food" },
    "場所": { color: "#43c59e", label: "Places" },
    "交通": { color: "#9b59b6", label: "Transport" },
    "ライブ": { color: "#e91e63", label: "Live Shows" }
};

const DEFAULT_COLOR = "#43c59e";
const MINIMAP_DEFAULT_ICON = 'images/minimap/asunaro.png';
const STREET_CATEGORY_ORDER = ['satsuki', 'kaede', 'asunaro', 'hiiragi', 'graduate', 'outside', 'kenkyuutou', 'toshokan'];
const MINIMAP_COLORS = {
    satsuki: '#2d9bf0',
    kaede: '#34a853',
    asunaro: '#fbbc04',
    hiiragi: '#a142f4',
    graduate: '#ff9800',
    outside: '#e84545',
    kenkyuutou: '#00acc1',
    toshokan: '#6d4c41'
};

// Grouping for streetview location cards (carousel).
// Add/remove keys here to control which categories get an outline + label.
const STREETVIEW_CARD_GROUPS = {
    satsuki: { label: 'さつき', color: MINIMAP_COLORS.satsuki },
    kaede: { label: 'かえで', color: MINIMAP_COLORS.kaede },
    asunaro: { label: 'あすなろ', color: MINIMAP_COLORS.asunaro },
    hiiragi: { label: 'ひいらぎ', color: MINIMAP_COLORS.hiiragi },
    graduate: { label: '大学院', color: MINIMAP_COLORS.graduate },
    kenkyuutou: { label: '研究棟', color: MINIMAP_COLORS.kenkyuutou },
    toshokan: { label: '図書館', color: MINIMAP_COLORS.toshokan },
    outside: { label: '屋外', color: MINIMAP_COLORS.outside }
};

const DEFAULT_STANDARD_STYLE_URL = 'https://api.maptiler.com/maps/streets-v4/style.json?key=z2iOmrIdt1L9Yw9QsXS3';

const BASE_LAYERS = {
    standard: { label: '標準地図' },
    satellite: { label: '衛星写真' }
};

// Global state
let map = null;
let markers = [];
let allData = [];
let selectedMarkerEl = null; // currently selected DOM marker element
let streetViewState = { active: false, currentItem: null, catalog: [], contextItems: [] };
let pannellumViewer = null;
let streetViewPopup = null;
let lastMarkerItems = null;
let streetViewAutoRotateEnabled = true;
let streetViewAutoRotateResumeTimer = 0;
let streetViewToastTimer = 0;
let currentBaseLayer = 'satellite';

const STREETVIEW_AUTO_ROTATE_SPEED = 0.7; // deg/sec (slow horizontal pan)

// Initialize map when data is loaded
window.initmap = function() {
    console.log('Initializing map with data:', window.dataObject);

    if (!window.dataObject || window.dataObject.length === 0) {
        showError('No data available. Please check the data source.');
        hideLoading();
        return;
    }

    allData = window.dataObject;
    refreshStreetViewCatalog();
    initializeMap();
    setupEventListeners();
    buildMinimapMarkers(allData);

    if (map.loaded()) {
        renderMarkersAndPanel();
    } else {
        map.on('load', () => {
            renderMarkersAndPanel();
        });
    }

    // Check for URL parameters to open specific panorama
    const urlParams = new URLSearchParams(window.location.search);
    const panoTarget = urlParams.get('pano');
    
    if (panoTarget) {
        const targetItem = allData.find(item => {
            const img = resolveStreetImage(item);
            return img && img.includes(panoTarget);
        });
        
        if (targetItem) {
            setTimeout(() => {
                enterStreetView(targetItem);
            }, 1000);
        }
    }

    hideLoading();
};

// Initialize MapLibre map
function initializeMap() {
    map = new maplibregl.Map({
        container: 'map',
        style: getBaseStyle(currentBaseLayer),
        center: CONFIG.center,
        zoom: CONFIG.zoom
    });

    // Add built-in zoom/compass controls
    map.addControl(new maplibregl.NavigationControl({ showZoom: true, showCompass: true }), 'top-right');
}

function getStandardStyleUrl() {
    return window.CUSTOM_STYLE_URL || DEFAULT_STANDARD_STYLE_URL;
}

function buildSatelliteStyle() {
    return {
        version: 8,
        sources: {
            satellite: {
                type: 'raster',
                tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
                tileSize: 256,
                attribution: '© Google',
                maxzoom: 21
            }
        },
        layers: [
            {
                id: 'satellite-layer',
                type: 'raster',
                source: 'satellite'
            }
        ]
    };
}

function getBaseStyle(layerKey) {
    if (layerKey === 'standard') {
        return getStandardStyleUrl();
    }
    return buildSatelliteStyle();
}

function setBaseLayer(layerKey) {
    if (!BASE_LAYERS[layerKey] || currentBaseLayer === layerKey) return;
    currentBaseLayer = layerKey;
    updateBasemapToggleUI(layerKey);

    if (!map) return;
    const nextStyle = getBaseStyle(layerKey);
    if (!nextStyle) return;
    map.setStyle(nextStyle, { diff: false });
}

function updateBasemapToggleUI(activeKey) {
    const buttons = document.querySelectorAll('#basemap-toggle [data-layer]');
    buttons.forEach(btn => {
        const isActive = btn.dataset.layer === activeKey;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
    });
}

function setupBasemapToggle() {
    const container = document.getElementById('basemap-toggle');
    if (!container || container.dataset.initialized === 'true') return;
    container.dataset.initialized = 'true';

    container.addEventListener('click', (event) => {
        const target = event.target.closest('[data-layer]');
        if (!target) return;
        setBaseLayer(target.dataset.layer);
    });

    updateBasemapToggleUI(currentBaseLayer);
}


// Group data by coordinates
function groupByCoordinates(data) {
    const groups = new Map();
    
    data.forEach(item => {
        const key = `${item.lat.toFixed(6)},${item.lon.toFixed(6)}`;
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key).push(item);
    });

    return groups;
}

// Simple filter passthrough (can be expanded with UI filters later)
function getFilteredData() {
    return Array.isArray(allData) ? allData : [];
}

// Render markers on map and update side panel
function renderMarkersAndPanel() {
    // Clear existing markers
    markers.forEach(marker => marker.remove());
    markers = [];
    selectedMarkerEl = null;
    hideStreetViewPopup();
    lastMarkerItems = null;
    updateStreetViewPanelButton(null, null);

    const filteredData = getFilteredData();
    const groupedData = groupByCoordinates(filteredData);

    // Create markers for each location
    groupedData.forEach((items, key) => {
        const [lat, lon] = key.split(',').map(Number);
        const count = items.length;
        
        // Get the primary category (most common in the group)
        const categories = items.map(item => (item.category || "場所").trim());
        const primaryCategory = getMostCommon(categories);
        const color = CATEGORIES[primaryCategory]?.color || DEFAULT_COLOR;

        // Create marker element
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.style.backgroundColor = color;
        const previewItem = items.find(hasStreetView) || items[0];
        const thumbUrl = previewItem ? getStreetThumbnail(previewItem) : '';
        if (thumbUrl) {
            const sanitizedThumb = thumbUrl.replace(/"/g, '\\"');
            el.style.backgroundImage = `linear-gradient(0deg, rgba(0,0,0,0.25), rgba(0,0,0,0.25)), url("${sanitizedThumb}")`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
        }
        el.title = `${count}件の場所`;

        // Create marker
        const marker = new maplibregl.Marker({ element: el })
            .setLngLat([lon, lat])
            .addTo(map);

        // Click handler: highlight with red ring, update panel, and (if possible) sync 360°ビュー
        el.addEventListener('click', () => {
            setSelectedMarker(el);
            // If mobile and panel is closed, open to 30%
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                const panelEl = document.getElementById('side-panel');
                if (panelEl && (panelEl.classList.contains('closed') || panelEl.offsetHeight <= 56)) {
                    panelEl.classList.remove('closed');
                    panelEl.classList.remove('expanded');
                    panelEl.style.height = '30%';
                }
            }

            lastMarkerItems = items;
            map.flyTo({
                center: [lon, lat],
                zoom: 18,
                duration: 1000
            });

            // ミニマップのマーカークリック時に360°ビューをその場所へ切り替える
            const streetItems = items.filter(hasStreetView);
            if (streetItems.length) {
                setStreetviewAnchorThumbnail(streetItems[0]);
                // Keep context ready but do not auto-start 360° on marker click
                streetViewState.contextItems = items.filter(hasStreetView);
            }

            showStreetViewPopup([lon, lat], items);
        });

        markers.push(marker);
    });
    
    // Zoom to fit all visible markers
    fitMapToMarkers(filteredData);
}

function setSelectedMarker(element) {
    if (selectedMarkerEl && selectedMarkerEl !== element) {
        selectedMarkerEl.classList.remove('selected');
    }
    selectedMarkerEl = element || null;
    if (selectedMarkerEl) {
        selectedMarkerEl.classList.add('selected');
    }
}

function selectMarkerByCoordinates(lat, lon) {
    if (!markers.length) return;
    const tolerance = 1e-6;
    const target = markers.find(marker => {
        const position = marker.getLngLat();
        return Math.abs(position.lat - lat) < tolerance && Math.abs(position.lng - lon) < tolerance;
    });
    setSelectedMarker(target ? target.getElement() : null);
}

function focusMapOnItem(item, options = {}) {
    if (!item || !Number.isFinite(item.lon) || !Number.isFinite(item.lat) || !map) return;
    const {
        zoom = 18,
        duration = 1000
    } = options;

    map.flyTo({
        center: [item.lon, item.lat],
        zoom,
        duration
    });

    selectMarkerByCoordinates(item.lat, item.lon);
}

function clearMarkerSelection() {
    setSelectedMarker(null);
    lastMarkerItems = null;
    hideStreetViewPopup();
}

function handleMapBackgroundClick(event) {
    if (streetViewState.active) return;
    const target = event?.target;
    if (target && typeof target.closest === 'function') {
        if (target.closest('.custom-marker') ||
            target.closest('#side-panel') ||
            target.closest('#streetview-anchor-btn') ||
            target.closest('#streetview-popup-anchor-btn') ||
            target.closest('#street-viewer')) {
            return;
        }
    }
    clearMarkerSelection();
}

// Fit map bounds to show all filtered markers
function fitMapToMarkers(data) {
    if (!data || data.length === 0) return;
    
    // Calculate bounds of all markers
    const bounds = new maplibregl.LngLatBounds();
    
    data.forEach(item => {
        bounds.extend([item.lon, item.lat]);
    });
    
    // Responsive padding based on screen size
    const isMobile = window.innerWidth <= 768;
    const padding = isMobile 
        ? { top: 160, bottom: window.innerHeight * 0.25, left: 24, right: 24 }
        : { top: 140, bottom: 80, left: 80, right: 80 };
    
    // Fit map to bounds with padding
    map.fitBounds(bounds, {
        padding: padding,
        maxZoom: 18,
        duration: 1000
    });
}

// Setup event listeners
function setupEventListeners() {
    const campusLinkBtn = document.getElementById('campus-map-link');
    if (campusLinkBtn) {
        campusLinkBtn.addEventListener('click', () => {
            window.open('https://www.reitaku-u.ac.jp/campuslife/campus-map/', '_blank', 'noopener,noreferrer');
            campusLinkBtn.classList.add('active');
            setTimeout(() => campusLinkBtn.classList.remove('active'), 600);
        });
    }

    setupBasemapToggle();

    // Mobile panel drag functionality
    setupMobilePanelDrag();
    setupMinimapControls();
    
    // Streetview controls
    const backBtn = document.getElementById('streetview-back-to-map');
    if (backBtn) backBtn.addEventListener('click', exitStreetView);
    const prevBtn = document.getElementById('streetview-nav-prev');
    if (prevBtn) prevBtn.addEventListener('click', () => navigateStreetView(-1));
    const nextBtn = document.getElementById('streetview-nav-next');
    if (nextBtn) nextBtn.addEventListener('click', () => navigateStreetView(1));
    const zoomInBtn = document.getElementById('streetview-zoom-in');
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => adjustStreetViewZoom(-10));
    const zoomOutBtn = document.getElementById('streetview-zoom-out');
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => adjustStreetViewZoom(10));
    const panelToggle = document.getElementById('streetview-panel-toggle');
    const infoPanel = document.getElementById('streetview-info-panel');
    if (panelToggle && infoPanel) {
        panelToggle.addEventListener('click', () => {
            const collapsed = infoPanel.classList.toggle('collapsed');
            const expanded = !collapsed;
            panelToggle.setAttribute('aria-expanded', String(expanded));
            panelToggle.textContent = expanded ? '画像を隠す' : '画像を開く';
            panelToggle.setAttribute('aria-label', expanded ? '画像を隠す' : '画像を開く');
        });
    }

    // Mobile streetview info bottom-sheet drag
    setupStreetviewPanelDrag();

    // Drag-scroll for streetview location cards carousel
    setupStreetviewCarouselDrag();

    // Streetview panel buttons
    setupStreetviewPanelButtons();

    // If user drags the panorama while autorotate is enabled, resume after interaction.
    setupStreetviewAutorotateResumeOnInteraction();

    document.addEventListener('keydown', (evt) => {
        if (evt.key === 'Escape' && streetViewState.active) {
            exitStreetView();
        }
    });

    // Close marker popup when clicking empty map space
    if (map && typeof map.getCanvas === 'function') {
        const canvas = map.getCanvas();
        if (canvas && !canvas.dataset.popupDismissHooked) {
            canvas.addEventListener('click', handleMapBackgroundClick);
            canvas.dataset.popupDismissHooked = 'true';
        }
    }
}

function setupStreetviewAutorotateResumeOnInteraction() {
    const host = document.getElementById('street-viewer-canvas');
    if (!host) return;
    if (host.dataset.autorotateResumeInitialized === 'true') return;
    host.dataset.autorotateResumeInitialized = 'true';

    let interacting = false;

    const clearResumeTimer = () => {
        if (streetViewAutoRotateResumeTimer) {
            clearTimeout(streetViewAutoRotateResumeTimer);
            streetViewAutoRotateResumeTimer = 0;
        }
    };

    const scheduleResume = () => {
        clearResumeTimer();
        if (!streetViewAutoRotateEnabled) return;
        // Pannellum stops autorotate on interaction; re-apply shortly after user finishes.
        streetViewAutoRotateResumeTimer = setTimeout(() => {
            streetViewAutoRotateResumeTimer = 0;
            if (!streetViewAutoRotateEnabled) return;
            applyStreetviewAutoRotate();
        }, 260);
    };

    const onStart = () => {
        interacting = true;
        clearResumeTimer();
    };

    const onEnd = () => {
        if (!interacting) return;
        interacting = false;
        scheduleResume();
    };

    // Start when the user begins dragging the panorama.
    host.addEventListener('pointerdown', onStart, { passive: true });
    host.addEventListener('mousedown', onStart, { passive: true });
    host.addEventListener('touchstart', onStart, { passive: true });

    // End even if the pointer is released outside the viewer.
    window.addEventListener('pointerup', onEnd, { passive: true });
    window.addEventListener('pointercancel', onEnd, { passive: true });
    window.addEventListener('mouseup', onEnd, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
}

function setupStreetviewPanelButtons() {
    const fullscreenBtn = document.getElementById('streetview-fullscreen-btn');
    const autorotateBtn = document.getElementById('streetview-autorotate-btn');
    const overlay = document.getElementById('street-viewer');

    const getFullscreenElement = () => {
        return document.fullscreenElement || document.webkitFullscreenElement || null;
    };

    const updateFullscreenBtn = () => {
        if (!fullscreenBtn) return;
        const isFullscreen = Boolean(getFullscreenElement());
        fullscreenBtn.setAttribute('aria-pressed', String(isFullscreen));
        fullscreenBtn.textContent = isFullscreen ? '全画面解除' : '全画面表示';
        fullscreenBtn.setAttribute('aria-label', isFullscreen ? '全画面解除' : '全画面表示');
    };

    const updateAutorotateBtn = () => {
        if (!autorotateBtn) return;
        autorotateBtn.setAttribute('aria-pressed', String(streetViewAutoRotateEnabled));
        autorotateBtn.textContent = streetViewAutoRotateEnabled ? '自動回転停止' : '自動回転モード';
        autorotateBtn.setAttribute('aria-label', streetViewAutoRotateEnabled ? '自動回転停止' : '自動回転モード');
    };

    if (fullscreenBtn && overlay) {
        fullscreenBtn.addEventListener('click', async () => {
            try {
                if (!getFullscreenElement()) {
                    if (overlay.requestFullscreen) {
                        await overlay.requestFullscreen();
                    } else if (overlay.webkitRequestFullscreen) {
                        overlay.webkitRequestFullscreen();
                    }
                } else {
                    if (document.exitFullscreen) {
                        await document.exitFullscreen();
                    } else if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen();
                    }
                }
            } catch (_) {
                // ignore
            } finally {
                updateFullscreenBtn();
            }
        });
        document.addEventListener('fullscreenchange', updateFullscreenBtn);
        document.addEventListener('webkitfullscreenchange', updateFullscreenBtn);
        updateFullscreenBtn();
    }

    if (autorotateBtn) {
        autorotateBtn.addEventListener('click', () => {
            streetViewAutoRotateEnabled = !streetViewAutoRotateEnabled;
            applyStreetviewAutoRotate();
            updateAutorotateBtn();
        });
        updateAutorotateBtn();
    }
}

function applyStreetviewAutoRotate() {
    if (!pannellumViewer) return;
    try {
        if (streetViewAutoRotateEnabled && typeof pannellumViewer.startAutoRotate === 'function') {
            pannellumViewer.startAutoRotate(STREETVIEW_AUTO_ROTATE_SPEED);
        } else if (!streetViewAutoRotateEnabled && typeof pannellumViewer.stopAutoRotate === 'function') {
            pannellumViewer.stopAutoRotate();
        } else if (!streetViewAutoRotateEnabled && typeof pannellumViewer.startAutoRotate === 'function') {
            // Fallback: startAutoRotate(0) stops in some builds
            pannellumViewer.startAutoRotate(0);
        }
    } catch (_) {
        // ignore
    }
}

function setupStreetviewCarouselDrag() {
    const carousel = document.getElementById('streetview-location-carousel');
    const prevBtn = document.getElementById('streetview-carousel-prev');
    const nextBtn = document.getElementById('streetview-carousel-next');
    if (!carousel) return;
    if (carousel.dataset.dragScrollInitialized === 'true') return;
    carousel.dataset.dragScrollInitialized = 'true';

    let pointerActive = false;
    let dragStarted = false;
    let startX = 0;
    let startScrollLeft = 0;
    let skipClickFromDrag = false;
    let capturedPointerId = null;
    let lastMoveX = 0;
    let lastMoveTime = 0;
    let velocity = 0;
    let momentumFrame = 0;
    let rubberBandOffset = 0;

    const maxScroll = () => carousel.scrollWidth - carousel.clientWidth;

    const scrollByAmount = (dir) => {
        const step = Math.max(240, carousel.clientWidth * 0.6);
        const target = Math.min(maxScroll(), Math.max(0, carousel.scrollLeft + dir * step));
        carousel.scrollTo({ left: target, behavior: 'smooth' });
    };

    const stopMomentum = () => {
        if (momentumFrame) {
            cancelAnimationFrame(momentumFrame);
            momentumFrame = 0;
        }
    };

    const resetRubberBand = () => {
        if (rubberBandOffset === 0) return;
        const startOffset = rubberBandOffset;
        const duration = 220;
        const startTime = performance.now();
        const easeOut = (t) => 1 - Math.pow(1 - t, 3);
        const step = (now) => {
            const t = Math.min(1, (now - startTime) / duration);
            const eased = easeOut(t);
            rubberBandOffset = startOffset * (1 - eased);
            carousel.style.transform = `translateX(${rubberBandOffset}px)`;
            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                rubberBandOffset = 0;
                carousel.style.transform = 'translateX(0)';
            }
        };
        requestAnimationFrame(step);
    };

    const triggerBounce = (overshoot) => {
        if (!overshoot) return;
        rubberBandOffset = -overshoot * 0.35;
        carousel.style.transform = `translateX(${rubberBandOffset}px)`;
        velocity = 0;
        momentumFrame = 0;
        resetRubberBand();
    };

    const start = (e) => {
        // Left mouse button only (for mouse). Touch/pen don't have button.
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        stopMomentum();
        pointerActive = true;
        dragStarted = false;
        startX = e.clientX;
        startScrollLeft = carousel.scrollLeft;
        lastMoveX = startX;
        lastMoveTime = performance.now();
        velocity = 0;
        rubberBandOffset = 0;
        carousel.style.transform = 'translateX(0)';
        carousel.classList.add('dragging');
        capturedPointerId = null;
    };

    const move = (e) => {
        if (!pointerActive) return;
        const dx = e.clientX - startX;

        // Small threshold to distinguish click vs drag
        if (!dragStarted && Math.abs(dx) > 6) {
            dragStarted = true;
            skipClickFromDrag = true;
            // Only capture the pointer once we're sure it's a drag. Capturing on pointerdown
            // can cause the subsequent click to target the carousel instead of the card button.
            try {
                carousel.setPointerCapture(e.pointerId);
                capturedPointerId = e.pointerId;
            } catch (_) {
                capturedPointerId = null;
            }
        }

        if (dragStarted) {
            let next = startScrollLeft - dx;
            const limit = maxScroll();
            let overshoot = 0;

            if (next < 0) {
                overshoot = next;
                next = 0;
            } else if (next > limit) {
                overshoot = next - limit;
                next = limit;
            }

            carousel.scrollLeft = next;
            if (overshoot !== 0) {
                // Reverse direction so the rubber-band pulls opposite to the drag beyond edges
                rubberBandOffset = -overshoot * 0.35;
                carousel.style.transform = `translateX(${rubberBandOffset}px)`;
            } else if (rubberBandOffset !== 0) {
                rubberBandOffset = 0;
                carousel.style.transform = 'translateX(0)';
            }
            const now = performance.now();
            const dt = now - lastMoveTime || 16;
            const deltaX = e.clientX - lastMoveX;
            if (dt > 0) {
                velocity = -(deltaX / dt);
            }
            lastMoveX = e.clientX;
            lastMoveTime = now;
            if (e.cancelable) e.preventDefault();
        }
    };

    const end = (e) => {
        if (!pointerActive) return;
        pointerActive = false;
        carousel.classList.remove('dragging');
        if (!dragStarted) {
            skipClickFromDrag = false;
        }
        dragStarted = false;
        const limit = maxScroll();
        carousel.scrollLeft = Math.min(limit, Math.max(0, carousel.scrollLeft));
        if (rubberBandOffset !== 0) {
            resetRubberBand();
            if (capturedPointerId != null) {
                try { carousel.releasePointerCapture(capturedPointerId); } catch (_) {}
                capturedPointerId = null;
            }
            return;
        }
        if (Math.abs(velocity) > 0.02) {
            let lastFrame = performance.now();
          const step = (now) => {
                const dt = now - lastFrame;
                lastFrame = now;
                const friction = 0.0030;
                velocity *= Math.pow(1 - friction, dt);
                const delta = velocity * dt;
                const limit = maxScroll();
                const proposed = carousel.scrollLeft + delta;

                if (proposed < 0 || proposed > limit) {
                    const overshoot = proposed < 0 ? proposed : proposed - limit;
                    carousel.scrollLeft = proposed < 0 ? 0 : limit;
                    triggerBounce(overshoot);
                    return;
                }

                carousel.scrollLeft = proposed;
                if (Math.abs(velocity) > 0.02) {
                    momentumFrame = requestAnimationFrame(step);
                } else {
                    momentumFrame = 0;
                }
            };
            momentumFrame = requestAnimationFrame(step);
        }
        if (capturedPointerId != null) {
            try { carousel.releasePointerCapture(capturedPointerId); } catch (_) {}
            capturedPointerId = null;
        }
    };

    // Capture-phase click suppression so card buttons don't fire after a drag.
    carousel.addEventListener('click', (evt) => {
        if (skipClickFromDrag) {
            skipClickFromDrag = false;
            evt.preventDefault();
            evt.stopPropagation();
        }
    }, true);

    carousel.addEventListener('pointerdown', start, { capture: true });
    carousel.addEventListener('pointermove', move, { passive: false });
    carousel.addEventListener('pointerup', end);
    carousel.addEventListener('pointercancel', end);
    carousel.addEventListener('lostpointercapture', () => {
        pointerActive = false;
        dragStarted = false;
        capturedPointerId = null;
        carousel.classList.remove('dragging');
        rubberBandOffset = 0;
        carousel.style.transform = 'translateX(0)';
    });

    if (prevBtn) {
        prevBtn.addEventListener('click', () => scrollByAmount(-1));
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', () => scrollByAmount(1));
    }
}

// Mobile-only drag handle for streetview info panel
function setupStreetviewPanelDrag() {
    const panel = document.getElementById('streetview-info-panel');
    const handle = document.getElementById('streetview-drag-handle');
    if (!panel || !handle) return;

    // PC(マウス/トラックパッド想定)ではドラッグハンドルを使わない
    const isPcLikePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (isPcLikePointer) {
        handle.remove();
        return;
    }

    let startY = 0;
    let startTranslate = 0; // 0 (fully open) to 1 (hidden except header)
    let dragging = false;

    const getPoint = (e) => (e.type.startsWith('touch') ? e.touches[0] : e);

    const getCurrentTranslate = () => {
        const style = window.getComputedStyle(panel);
        const matrix = style.transform;
        if (!matrix || matrix === 'none') return 0;
        const match = matrix.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,([^\)]+)\)/);
        if (!match) return 0;
        const ty = parseFloat(match[1]) || 0;
        const height = panel.offsetHeight || 1;
        return Math.max(0, Math.min(1, ty / height));
    };

    const applyTranslate = (ratio) => {
        const clamped = Math.max(0, Math.min(1, ratio));
        const height = panel.offsetHeight || 1;
        const ty = clamped * height;
        panel.style.transform = `translateY(${ty}px)`;
        const collapsed = clamped > 0.7;
        panel.classList.toggle('collapsed', collapsed);
        const panelToggle = document.getElementById('streetview-panel-toggle');
        if (panelToggle) {
            const expanded = !collapsed;
            panelToggle.setAttribute('aria-expanded', String(expanded));
            panelToggle.textContent = expanded ? '画面を隠す' : '画面を開く';
            panelToggle.setAttribute('aria-label', expanded ? '画面を隠す' : '画面を開く');
        }
    };

    const onStart = (e) => {
        const pt = getPoint(e);
        dragging = true;
        startY = pt.clientY;
        startTranslate = getCurrentTranslate();
        panel.classList.add('dragging');
        panel.style.transition = 'none';
        document.body.style.userSelect = 'none';
        if (e.cancelable) e.preventDefault();
    };

    const onMove = (e) => {
        if (!dragging) return;
        const pt = getPoint(e);
        const deltaY = pt.clientY - startY;
        const height = panel.offsetHeight || 1;
        const ratioDelta = deltaY / height;
        applyTranslate(startTranslate + ratioDelta);
        if (e.cancelable) e.preventDefault();
    };

    const onEnd = () => {
        if (!dragging) return;
        dragging = false;
        panel.classList.remove('dragging');
        panel.style.transition = 'transform 0.3s ease';
        document.body.style.userSelect = '';

        // Snap: open (0) or collapsed (~0.85)
        const current = getCurrentTranslate();
        const target = current > 0.35 ? 0.85 : 0;
        applyTranslate(target);
    };

    handle.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);

    handle.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
}

// Setup draggable panel for mobile
function setupMobilePanelDrag() {
    const panel = document.getElementById('side-panel');
    const handle = document.getElementById('panel-drag-handle');
    // サイドパネルは2Dマップでは使用しないため、ドラッグ処理も無効化
    if (!panel) return;

    let startY = 0;
    let startHeight = 0;
    let isDragging = false;
    const handleMinHeight = 64; // keep handle visible when closed
    const dragZone = 72; // px zone from top that can initiate drag

    const isPanelClosed = () => true;

    const getTouchPoint = (e) => (e.type.includes('touch') ? e.touches[0] : e);

    const withinDragZone = (point) => {
        const rect = panel.getBoundingClientRect();
        if (isPanelClosed()) {
            return point.clientY >= rect.top && point.clientY <= rect.bottom;
        }
        return point.clientY <= rect.top + dragZone;
    };

    const startDrag = (e, forced = false) => {
        if (window.innerWidth > 768) return; // Only on mobile
        const point = getTouchPoint(e);
        if (!forced && !withinDragZone(point)) return;

        isDragging = true;
        startY = point.clientY;
        startHeight = panel.offsetHeight;

        document.body.style.userSelect = 'none';
        panel.style.transition = 'none';

        if (e.cancelable) {
            e.preventDefault();
        }
    };

    const doDrag = (e) => {
        if (!isDragging) return;
        
        const touch = e.type.includes('touch') ? e.touches[0] : e;
        const currentY = touch.clientY;
        const deltaY = startY - currentY; // Positive when dragging up
        const newHeight = startHeight + deltaY;
        const windowHeight = window.innerHeight;
        
        // Constrain between handle height (closed) and 100%
        const minHeight = handleMinHeight;
        const maxHeight = windowHeight;
        
        if (newHeight >= minHeight && newHeight <= maxHeight) {
            panel.style.height = `${newHeight}px`;
        }
    };

    const endDrag = () => {
        if (!isDragging) return;
        
        isDragging = false;
        document.body.style.userSelect = '';
        panel.style.transition = 'height 0.3s ease';
        
        const currentHeight = panel.offsetHeight;
        const windowHeight = window.innerHeight;
        
        // Snap to closed (handle), 30%, or 100%
        if (currentHeight < windowHeight * 0.18) {
            panel.classList.remove('expanded');
            panel.classList.add('closed');
            panel.style.height = `${handleMinHeight}px`;
        } else if (currentHeight > windowHeight * 0.6) {
            panel.classList.add('expanded');
            panel.classList.remove('closed');
            panel.style.height = '100%';
        } else {
            panel.classList.remove('expanded');
            panel.classList.remove('closed');
            panel.style.height = '30%';
        }
    };

    // Mouse events
    // パネルは非表示なので、ドラッグイベントは登録しない

    const handleTouchMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        doDrag(e);
    };

    panel.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    
    panel.addEventListener('touchend', endDrag);
    document.addEventListener('touchend', endDrag);
}


function normalizeMinimapCategory(category) {
    const base = String(category || '').trim().toLowerCase();
    const noExt = base.replace(/\.[a-z0-9]+$/, '');
    return noExt.replace(/[^a-z0-9_-]+/g, '');
}

function getMinimapIconPath(category) {
    const slug = normalizeMinimapCategory(category);
    return slug ? `images/minimap/${slug}.png` : MINIMAP_DEFAULT_ICON;
}

function getMinimapColor(category) {
    const slug = normalizeMinimapCategory(category);
    return MINIMAP_COLORS[slug] || '#2d9bf0';
}

function isValidMinimapCoord(value) {
    const num = toFinite(value);
    return Number.isFinite(num) ? num : undefined;
}

function activateMinimapMarker(markerEl) {
    const layer = document.getElementById('streetview-minimap-markers');
    if (!layer) return;
    layer.querySelectorAll('.minimap-marker.active').forEach(el => el.classList.remove('active'));
    if (markerEl) markerEl.classList.add('active');
}

function buildMinimapMarkers(items, activeSlug) {
    const layer = document.getElementById('streetview-minimap-markers');
    const wrap = document.getElementById('streetview-minimap-wrap');
    const img = document.getElementById('streetview-minimap');
    if (!layer || !wrap || !img) return;

    layer.innerHTML = '';
    if (!Array.isArray(items)) return;
    clearMinimapPopup();

    const normalizeCoord = (v) => {
        const num = isValidMinimapCoord(v);
        if (!Number.isFinite(num)) return undefined;
        // Accept 0-1 as fractions; otherwise treat as percent
        const scaled = num >= 0 && num <= 1 ? num * 100 : num;
        return Math.max(0, Math.min(100, scaled));
    };

    const slugFilter = activeSlug ? normalizeMinimapCategory(activeSlug) : '';
    const filtered = items.filter(hasStreetView);

    filtered.forEach((item, idx) => {
        const x = normalizeCoord(item?.minimapX ?? item?.minimap_x ?? item?.minimapx);
        const y = normalizeCoord(item?.minimapY ?? item?.minimap_y ?? item?.minimapy);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;

        const catSlug = normalizeMinimapCategory(item?.minimapCategory || item?.category);
        if (slugFilter && catSlug !== slugFilter) return;

        const marker = document.createElement('div');
        marker.className = 'minimap-marker';
        marker.style.left = `${x}%`;
        marker.style.top = `${y}%`;
        const color = getMinimapColor(item?.minimapCategory || item?.category);
        marker.style.setProperty('--minimap-color', color);
        marker.dataset.cx = String(x);
        marker.dataset.cy = String(y);
        marker.dataset.cat = catSlug;
        marker.dataset.idx = String(idx);

        marker.addEventListener('mouseenter', () => {
            showMinimapMarkerPopup(marker, item);
        });

        marker.addEventListener('mouseleave', () => {
            clearMinimapPopup();
        });

        marker.addEventListener('click', (evt) => {
            evt.stopPropagation();
            activateMinimapMarker(marker);
            const sameSlugItems = filtered.filter(entry => normalizeMinimapCategory(entry?.minimapCategory || entry?.category) === catSlug);
            if (hasStreetView(item)) {
                const context = sameSlugItems.length ? sameSlugItems : filtered;
                enterStreetView(item, context);
            } else {
                showError('この場所には360°画像が登録されていません。');
            }
        });

        layer.appendChild(marker);
    });
}

function highlightMinimapMarkerForItem(item) {
    const layer = document.getElementById('streetview-minimap-markers');
    if (!layer) return;
    if (!item) {
        activateMinimapMarker(null);
        clearMinimapPopup();
        return;
    }
    const target = Array.from(layer.querySelectorAll('.minimap-marker')).find(el => {
        return el.dataset.cx === String(item?.minimapX ?? '')
            && el.dataset.cy === String(item?.minimapY ?? '')
            && el.dataset.cat === normalizeMinimapCategory(item?.minimapCategory || item?.category);
    });
    activateMinimapMarker(target || null);
}

function setMinimapBaseForItem(item) {
    const img = document.getElementById('streetview-minimap');
    if (!img) return '';
    const slug = normalizeMinimapCategory(item?.minimapCategory || item?.category);
    const nextSrc = slug ? `images/minimap/${slug}.png` : MINIMAP_DEFAULT_ICON;
    if (img.getAttribute('src') !== nextSrc) {
        img.setAttribute('src', nextSrc);
    }
    return slug;
}

function showMinimapCoordToast(x, y) {
    const id = 'minimap-coord-toast';
    let toast = document.getElementById(id);
    if (!toast) {
        toast = document.createElement('div');
        toast.id = id;
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 9999,
            background: 'rgba(0,0,0,0.78)',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
            maxWidth: '260px',
            lineHeight: '1.4',
            transition: 'opacity 0.2s ease',
            opacity: '0'
        });
        document.body.appendChild(toast);
    }
    toast.textContent = `Minimap X: ${x.toFixed(2)}, Y: ${y.toFixed(2)} (copied)`;
    toast.style.opacity = '1';
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2200);
}

function clearMinimapPopup() {
    const layer = document.getElementById('streetview-minimap-markers');
    if (!layer) return;
    const pop = layer.querySelector('.minimap-popup');
    if (pop) pop.remove();
}

function showMinimapMarkerPopup(markerEl, item) {
    const layer = document.getElementById('streetview-minimap-markers');
    if (!layer || !markerEl) return;
    let pop = layer.querySelector('.minimap-popup');
    if (!pop) {
        pop = document.createElement('div');
        pop.className = 'minimap-popup';
        layer.appendChild(pop);
    }
    const name = getStreetDisplayName(item);
    pop.textContent = name;
    pop.style.left = markerEl.style.left;
    const yNum = parseFloat(markerEl.dataset.cy || '0');
    pop.style.top = `${Math.max(0, yNum - 6)}%`;
}

function setupMinimapControls() {
    const wrap = document.getElementById('streetview-minimap-wrap');
    const img = document.getElementById('streetview-minimap');
    if (!wrap) return;
    wrap.addEventListener('click', (evt) => {
        if (evt.target === wrap) {
            activateMinimapMarker(null);
            clearMinimapPopup();
        }
    });
    if (img) {
        img.addEventListener('click', (evt) => {
            const rect = img.getBoundingClientRect();
            const x = ((evt.clientX - rect.left) / rect.width) * 100;
            const y = ((evt.clientY - rect.top) / rect.height) * 100;
            const payload = `${x.toFixed(2)}, ${y.toFixed(2)}`;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(payload).catch(() => {});
            }
            showMinimapCoordToast(x, y);
        });
    }
    buildMinimapMarkers(allData);
}

function updateMinimapExpandState(forceState) {
    // Kept for compatibility; expansion handled via CSS hover
    const btn = document.getElementById('minimap-expand-btn');
    if (btn) btn.style.display = 'none';
}

function showStreetViewPopup(lngLat, itemsAtMarker) {
    if (!map) return;
    const streetItems = Array.isArray(itemsAtMarker) ? itemsAtMarker.filter(hasStreetView) : [];
    if (!streetItems.length) {
        hideStreetViewPopup();
        updateStreetViewPanelButton(null, null);
        return;
    }

    if (!streetViewPopup) {
        streetViewPopup = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            className: 'streetview-marker-popup',
            offset: 18
        });
    }

    const container = document.createElement('div');
    container.className = 'streetview-popup-body';

    const popupAnchorBtn = document.createElement('button');
    popupAnchorBtn.id = 'streetview-popup-anchor-btn';
    popupAnchorBtn.type = 'button';
    popupAnchorBtn.className = 'streetview-popup-anchor-btn';
    popupAnchorBtn.setAttribute('aria-pressed', 'false');
    popupAnchorBtn.setAttribute('aria-label', '切り替え');
    popupAnchorBtn.textContent = '⥩ 360°表示';
    container.appendChild(popupAnchorBtn);


    const locationName = getPopupLocationLabel(itemsAtMarker?.[0]);
    if (locationName) {
        const locationRow = document.createElement('p');
        locationRow.className = 'streetview-popup-location';
        locationRow.textContent = locationName;
        container.appendChild(locationRow);
    }

    streetViewPopup
        .setLngLat(lngLat)
        .setDOMContent(container)
        .addTo(map);

    updateStreetViewPanelButton(itemsAtMarker, itemsAtMarker);
}

function hideStreetViewPopup() {
    if (streetViewPopup) {
        streetViewPopup.remove();
    }
}

function updateStreetViewPanelButton(streetItems, itemsAtMarker) {
    const anchorBtns = [
        document.getElementById('streetview-anchor-btn'),
        document.getElementById('streetview-popup-anchor-btn')
    ].filter(Boolean);

    if (!anchorBtns.length) return;

    const localItems = Array.isArray(streetItems) ? streetItems.filter(hasStreetView) : [];
    const catalogItems = streetViewState.catalog.filter(hasStreetView);
    const preferred = localItems[0] || catalogItems[0] || null;
    setStreetviewAnchorThumbnail(preferred);
    const isActive = streetViewState.active;
    const canToggle = isActive || localItems.length > 0 || catalogItems.length > 0;

    const handleToggle = () => {
        if (streetViewState.active) {
            exitStreetView();
            return;
        }

        if (localItems.length) {
            const context = Array.isArray(itemsAtMarker) && itemsAtMarker.length ? itemsAtMarker : localItems;
            enterStreetView(localItems[0], context);
            return;
        }

        if (catalogItems.length) {
            enterStreetView(catalogItems[0], catalogItems);
            return;
        }

        showError('360°スポットが登録されていません。');
    };

    anchorBtns.forEach(btn => {
        btn.disabled = !canToggle;
        btn.setAttribute('aria-pressed', String(isActive));
        btn.classList.toggle('active', isActive);
        btn.onclick = canToggle ? handleToggle : null;
    });
}

function setStreetviewAnchorThumbnail(item) {
    const anchors = [
        document.getElementById('streetview-anchor-btn'),
        document.getElementById('streetview-popup-anchor-btn')
    ].filter(Boolean);
    if (!anchors.length) return;

    const thumbUrl = item && hasStreetView(item) ? getStreetThumbnail(item) : '';
    const sanitizedThumb = thumbUrl ? thumbUrl.replace(/"/g, '\\"') : '';
    const fallbackBg = 'linear-gradient(135deg, #3d4250, #161b26)';
    const bgValue = sanitizedThumb
        ? `linear-gradient(170deg, rgba(0,0,0,0.05) 10%, rgba(0,0,0,0.65) 100%), url("${sanitizedThumb}")`
        : fallbackBg;

    anchors.forEach(btn => {
        btn.style.backgroundImage = bgValue;
        btn.style.backgroundSize = 'cover';
        btn.style.backgroundPosition = 'center';
        btn.style.backgroundRepeat = 'no-repeat';
    });
}

function refreshStreetViewCatalog() {
    const catalog = allData.filter(hasStreetView);
    catalog.sort(compareStreetItems);
    streetViewState.catalog = catalog;
    if (streetViewState.active && streetViewState.currentItem && !hasStreetView(streetViewState.currentItem)) {
        exitStreetView();
    } else {
        updateStreetViewInfoPanel();
    }
    const contextItems = Array.isArray(lastMarkerItems) && lastMarkerItems.length ? lastMarkerItems : null;
    updateStreetViewPanelButton(contextItems, contextItems || streetViewState.catalog);
}

function hasStreetView(item) {
    return Boolean(resolveStreetImage(item));
}

function resolveStreetImage(item) {
    if (!item) return '';
    const raw = item.streetViewImage || item.streetviewImage || item.streetview || item.panorama || '';
    if (!raw) return '';
    const trimmed = String(raw).trim();
    if (!trimmed) return '';
    const normalized = trimmed.replace(/\\/g, '/');
    if (/^https?:\/\//i.test(normalized)) return normalized;
    if (normalized.startsWith('images/')) return normalized;
    if (normalized.startsWith('part')) return `images/${normalized}`;
    if (normalized.startsWith('/')) return normalized.slice(1);
    if (normalized.includes('/')) return `images/${normalized}`;
    return `images/part2/${normalized}`;
}

function resolveStreetThumbnail(item) {
    const panorama = resolveStreetImage(item);
    if (!panorama) return '';
    const normalized = panorama.replace(/\\/g, '/');
    if (/^https?:\/\//i.test(normalized)) return normalized;
    const match = normalized.match(/^(images\/part\d+\/)(.+)$/i);
    if (match) {
        const [, basePath, rest] = match;
        if (!/^thumbs\//i.test(rest)) {
            return `${basePath}thumbs/${rest}`;
        }
    }
    return normalized;
}

function getStreetThumbnail(item) {
    const thumbnail = resolveStreetThumbnail(item);
    if (thumbnail) return thumbnail;
    const img = item?.imageUrl || item?.image;
    if (!img) return '';
    const normalized = String(img).trim().replace(/\\/g, '/');
    if (/^https?:\/\//i.test(normalized)) return normalized;
    if (normalized.startsWith('images/')) return normalized;
    if (normalized.startsWith('icons/')) return normalized;
    if (normalized.startsWith('part')) return `images/${normalized}`;
    if (normalized.startsWith('/')) return normalized.slice(1);
    return normalized;
}

function enterStreetView(item, contextItems) {
    if (!item) return;
    const panorama = resolveStreetImage(item);

    // Check if we need to open in parent overlay (Embedded mode)
    const isEmbedded = window.self !== window.top;
    const isOverlay = new URLSearchParams(window.location.search).has('pano');
    
    if (isEmbedded && !isOverlay) {
        // We are in the embedded map, request parent to open overlay
        window.parent.postMessage({
            type: 'reitaku:openMapOverlay',
            pano: panorama
        }, '*');
        return;
    }

    if (!panorama) {
        showError('この場所には360°画像が登録されていません。');
        return;
    }

    if (!window.pannellum || typeof window.pannellum.viewer !== 'function') {
        console.error('Pannellum viewer is not available.');
        return;
    }

    if (!streetViewState.catalog.length) {
        refreshStreetViewCatalog();
    }

    const contextual = Array.isArray(contextItems) && contextItems.length
        ? contextItems.filter(hasStreetView)
        : streetViewState.catalog;

    streetViewState.currentItem = item;
    streetViewState.contextItems = contextual;
    setStreetMode(true);
    showStreetViewToast(getStreetDisplayName(item));
    const slug = setMinimapBaseForItem(item);
    buildMinimapMarkers(allData, slug);
    highlightMinimapMarkerForItem(item);
    renderStreetViewer(item, panorama);
    updateStreetViewInfoPanel();
}

function navigateStreetView(step) {
    const sequence = getStreetSequence();
    if (!sequence.length) return;

    const target = getStreetNavTarget(step, sequence);
    if (target) {
        enterStreetView(target, sequence);
    }
}

function getStreetNavTarget(step, sequence = getStreetSequence()) {
    const list = Array.isArray(sequence) ? sequence : [];
    const total = list.length;
    if (total <= 1 || !Number.isInteger(step) || step === 0) return null;

    const current = streetViewState.currentItem;
    let index = list.indexOf(current);
    if (index === -1) {
        index = 0;
    }

    const normalizedStep = ((step % total) + total) % total;
    if (normalizedStep === 0) return null;
    const targetIndex = (index + normalizedStep) % total;
    return list[targetIndex] || null;
}

function syncStreetNavButton(button, target, direction) {
    if (!button) return;
    const baseLabel = direction === 'next' ? '次のスポット' : '前のスポット';
    if (target) {
        const locationName = getStreetDisplayName(target);
        button.dataset.location = locationName;
        button.setAttribute('aria-label', `${baseLabel}: ${locationName}`);
    } else {
        button.dataset.location = '';
        button.setAttribute('aria-label', baseLabel);
    }
}

function adjustStreetViewZoom(delta) {
    if (!pannellumViewer || typeof pannellumViewer.getHfov !== 'function' || typeof pannellumViewer.setHfov !== 'function') {
        return;
    }
    const current = pannellumViewer.getHfov();
    const next = clampFov((Number.isFinite(current) ? current : 90) + delta);
    pannellumViewer.setHfov(next, false);
}

// compass updater removed — using pannellum's built-in compass

function exitStreetView() {
    if (!streetViewState.active) return;
    // Stop autorotation when leaving street mode
    streetViewAutoRotateEnabled = false;
    applyStreetviewAutoRotate();
    // If we are in fullscreen, exit it
    const overlay = document.getElementById('street-viewer');
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement || null;
    if (overlay && fsEl === overlay) {
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
            try { document.webkitExitFullscreen(); } catch (_) {}
        }
    }
    streetViewState.currentItem = null;
    streetViewState.contextItems = [];
    setStreetMode(false);
    updateStreetViewInfoPanel();
    hideStreetViewToast();
}

function renderStreetViewer(item, panoramaUrl) {
    const container = document.getElementById('street-viewer-canvas');
    if (!container) return;
    container.classList.add('is-loading');
    container.innerHTML = '';
    if (!window.pannellum || typeof window.pannellum.viewer !== 'function') {
        showError('360°ビュー用ライブラリの読み込みに失敗しました。');
        return;
    }

    const yaw = toFinite(item.streetViewYaw);
    const pitch = toFinite(item.streetViewPitch);
    const fov = toFinite(item.streetViewFov);

    pannellumViewer = pannellum.viewer('street-viewer-canvas', {
        type: 'equirectangular',
        panorama: panoramaUrl,
        autoLoad: true,
        showControls: false,
        showZoomCtrl: false,
        showFullscreenCtrl: false,
        compass: true,
        pitch: pitch ?? 0,
        yaw: yaw ?? 0,
        hfov: clampFov(fov ?? 110),
        minHfov: 45,
        maxHfov: 120,
        escapeHTML: true
    });

    const handlePanoramaLoaded = () => {
        requestAnimationFrame(() => {
            container.classList.remove('is-loading');
        });
    };

    const fadeInFallback = setTimeout(handlePanoramaLoaded, 1200);

    if (pannellumViewer && typeof pannellumViewer.on === 'function') {
        pannellumViewer.on('load', () => {
            clearTimeout(fadeInFallback);
            handlePanoramaLoaded();
        });
    } else {
        handlePanoramaLoaded();
    }

    // Re-apply autorotation if enabled
    applyStreetviewAutoRotate();
}

function setStreetMode(isActive) {
    const wasActive = streetViewState.active;
    streetViewState.active = isActive;
    const body = document.body;
    const overlay = document.getElementById('street-viewer');
    const infoPanel = document.getElementById('streetview-info-panel');
    const panelToggle = document.getElementById('streetview-panel-toggle');
    if (!body || !overlay) return;

    if (isActive && !wasActive) {
        body.classList.add('street-mode');
        overlay.setAttribute('aria-hidden', 'false');
        hideStreetViewPopup();
        if (infoPanel) infoPanel.classList.remove('collapsed');
        if (panelToggle) panelToggle.setAttribute('aria-expanded', 'true');
        updateMinimapExpandState(false);
        // using built-in pannellum compass
    } else if (!isActive && wasActive) {
        body.classList.remove('street-mode');
        overlay.setAttribute('aria-hidden', 'true');
        updateMinimapExpandState(false);
        // using built-in pannellum compass
    }

    if (map && wasActive !== isActive) {
        requestAnimationFrame(() => map.resize());
        setTimeout(() => map && map.resize(), 420);
    }
    const contextItems = streetViewState.contextItems.length ? streetViewState.contextItems : lastMarkerItems;
    const markerContext = Array.isArray(contextItems) && contextItems.length ? contextItems : null;
    updateStreetViewPanelButton(markerContext, markerContext || streetViewState.catalog);
}

function updateStreetViewInfoPanel() {
    const titleEl = document.getElementById('streetview-current-title');
    const metaEl = document.getElementById('streetview-current-meta');
    const catEl = document.getElementById('streetview-current-category');
    const carousel = document.getElementById('streetview-location-carousel');
    const prevBtn = document.getElementById('streetview-nav-prev');
    const nextBtn = document.getElementById('streetview-nav-next');
    if (!titleEl || !metaEl || !catEl || !carousel) return;
    const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');

    const current = streetViewState.currentItem;
    if (!current) {
        titleEl.textContent = 'スポット未選択';
        metaEl.textContent = '360°スポットを選択してください。';
        catEl.textContent = '';
    } else {
        titleEl.textContent = getStreetDisplayName(current);
        metaEl.textContent = getStreetMeta(current);
        catEl.textContent = (current.category || 'スポット');
    }

    carousel.innerHTML = '';
    const catalog = getStreetSequence();

    const resolveGroupKey = (spot) => {
        const slug = getStreetGroupSlug(spot);
        return slug && STREETVIEW_CARD_GROUPS[slug] ? slug : '';
    };

    const createGroupEl = (groupKey) => {
        const def = STREETVIEW_CARD_GROUPS[groupKey] || {};
        const group = document.createElement('div');
        group.className = 'streetview-card-group';
        group.dataset.group = groupKey;
        const color = def.color || getMinimapColor(groupKey) || '#2d9bf0';
        group.style.setProperty('--group-color', color);

        const label = document.createElement('div');
        label.className = 'streetview-card-group-label';
        label.textContent = def.label || groupKey;
        group.appendChild(label);

        const cards = document.createElement('div');
        cards.className = 'streetview-card-group-cards';
        group.appendChild(cards);
        return group;
    };

    const canLazyLoadThumbs = 'IntersectionObserver' in window;
    const thumbObserver = canLazyLoadThumbs
        ? new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const target = entry.target;
                const dataUrl = target.dataset.thumb;
                if (dataUrl) {
                    target.style.backgroundImage = `url("${dataUrl}")`;
                    target.classList.remove('loading');
                    delete target.dataset.thumb;
                }
                observer.unobserve(target);
            });
        }, { root: carousel, rootMargin: '120px 0px', threshold: 0.05 })
        : null;

    const fragment = document.createDocumentFragment();
    let activeGroupKey = '';
    let activeGroupCardsEl = null;

    catalog.forEach((spot) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'streetview-location-card' + (spot === current ? ' active' : '');

        const thumb = document.createElement('div');
        thumb.className = 'streetview-location-card-thumb';
        const thumbUrl = getStreetThumbnail(spot);
        const sanitizedThumb = thumbUrl ? thumbUrl.replace(/"/g, '\"') : '';
        if (sanitizedThumb) {
            if (thumbObserver) {
                thumb.dataset.thumb = sanitizedThumb;
                thumb.classList.add('loading');
                thumbObserver.observe(thumb);
            } else {
                thumb.style.backgroundImage = `url("${sanitizedThumb}")`;
            }
        } else {
            thumb.style.background = 'linear-gradient(135deg, #1e3c72, #2a5298)';
        }

        const displayName = getStreetDisplayName(spot);
        const label = document.createElement('div');
        label.className = 'streetview-location-card-label';
        label.textContent = displayName;

        const normalizedDisplay = displayName.toLowerCase();
        const locationText = cleanText(spot.location);
        const safeCandidate = (value, compare = normalizedDisplay) => {
            if (!value) return '';
            return value.toLowerCase() === compare ? '' : value;
        };

        const subtitleText = safeCandidate(locationText);
        if (subtitleText) {
            const subtitle = document.createElement('span');
            subtitle.className = 'streetview-location-card-subtitle';
            subtitle.textContent = subtitleText;
            label.appendChild(subtitle);
        }

        thumb.appendChild(label);
        card.appendChild(thumb);

        card.addEventListener('click', () => {
            focusMapOnItem(spot, { duration: 800 });
            if (spot !== current) {
                enterStreetView(spot, catalog);
            }
        });

        const groupKey = resolveGroupKey(spot);
        if (groupKey) {
            if (groupKey !== activeGroupKey || !activeGroupCardsEl) {
                activeGroupKey = groupKey;
                const groupEl = createGroupEl(groupKey);
                activeGroupCardsEl = groupEl.querySelector('.streetview-card-group-cards');
                fragment.appendChild(groupEl);
            }
            activeGroupCardsEl.appendChild(card);
        } else {
            activeGroupKey = '';
            activeGroupCardsEl = null;
            fragment.appendChild(card);
        }
    });

    carousel.appendChild(fragment);

    if (!catalog.length) {
        const emptyMsg = document.createElement('p');
        emptyMsg.style.margin = '8px 0 0';
        emptyMsg.style.color = 'rgba(255,255,255,0.65)';
        emptyMsg.textContent = '360°スポットが登録されていません。';
        carousel.appendChild(emptyMsg);
    }

    syncStreetNavButton(prevBtn, getStreetNavTarget(-1, catalog), 'prev');
    syncStreetNavButton(nextBtn, getStreetNavTarget(1, catalog), 'next');

    highlightMinimapMarkerForItem(current);

    const navDisabled = !streetViewState.active || catalog.length <= 1;
    if (prevBtn) {
        prevBtn.disabled = navDisabled;
    }
    if (nextBtn) {
        nextBtn.disabled = navDisabled;
    }
}

function getStreetSequence() {
    const catalogSeq = streetViewState.catalog.filter(hasStreetView);
    if (catalogSeq.length) return catalogSeq;
    const contextSeq = streetViewState.contextItems.filter(hasStreetView);
    if (contextSeq.length) return contextSeq;
    if (Array.isArray(lastMarkerItems) && lastMarkerItems.length) {
        const markerSeq = lastMarkerItems.filter(hasStreetView);
        if (markerSeq.length) return markerSeq;
    }
    return [];
}

function getStreetMeta(item) {
    const parts = [];
    const location = (item.location || '').trim();
    if (location) parts.push(location);
    if (item.category) parts.push(item.category);
    return parts.filter(Boolean).join(' · ') || '360°ビューをお楽しみください';
}

function getStreetDisplayName(item) {
    const classroom = (item?.classroomname || '').trim();
    const title = (item?.title || '').trim();
    const location = (item?.location || '').trim();
    return classroom || title || location || 'スポット';
}

function getStreetGroupSlug(item) {
    if (!item) return '';

    const parts = [
        item?.classroomname,
        item?.title,
        item?.location,
        item?.building,
        item?.minimapCategory,
        item?.category
    ]
        .filter(v => typeof v === 'string' && v.trim().length)
        .map(v => v.trim());

    const joined = parts.join(' ');
    const joinedNormalized = joined.replace(/＆/g, '&');

    // Manual overrides based on card text.
    // "広場" は屋外グループに含める。
    if (joined.includes('広場')) return 'outside';

    // "麗澤大学院&生涯教育プラザ"（区切り記号の揺れ含む）は大学院グループに含める。
    if (/麗澤大学院\s*[&・･]\s*生涯教育プラザ/.test(joinedNormalized)) return 'graduate';
    if (joined.includes('麗澤大学院') || joined.includes('生涯教育プラザ')) return 'graduate';
    // Fallback: any "大学院" spot goes to graduate group if not otherwise categorized.
    if (joined.includes('大学院')) return 'graduate';

    return normalizeMinimapCategory(item?.minimapCategory || item?.category);
}

function getExplicitPriority(item) {
    if (!item) return null;
    // Try exact matches first
    let val = item.priority || item.order || item.sort;
    
    // If not found, try case-insensitive/trimmed search
    if (val === undefined) {
        const keys = Object.keys(item);
        for (const key of keys) {
            const norm = key.trim().toLowerCase();
            if (norm === 'priority' || norm === 'order' || norm === 'sort') {
                val = item[key];
                break;
            }
        }
    }

    if (val !== undefined && val !== '') {
        const num = parseFloat(val);
        if (!isNaN(num)) return num;
    }
    return null;
}

function getStreetPriority(item) {
    // Ensure key campus buildings lead within their category
    const building = (item?.building || '').trim();
    if (building === 'さつき校舎' || building === 'かえで校舎') return 0;
    return 10;
}

function compareStreetItems(a, b) {
    // 1. Category order (keeps category groups contiguous)
    const order = STREET_CATEGORY_ORDER;
    const slugA = getStreetGroupSlug(a);
    const slugB = getStreetGroupSlug(b);
    const idxA = order.indexOf(slugA);
    const idxB = order.indexOf(slugB);
    const rankA = idxA >= 0 ? idxA : order.length;
    const rankB = idxB >= 0 ? idxB : order.length;
    if (rankA !== rankB) return rankA - rankB;

    // 2. Explicit ordering within the same category
    const pA = getExplicitPriority(a);
    const pB = getExplicitPriority(b);
    if (pA !== null && pB !== null) return pA - pB;
    if (pA !== null) return -1;
    if (pB !== null) return 1;

    // 3. Category-internal priority
    const priorityA = getStreetPriority(a);
    const priorityB = getStreetPriority(b);
    if (priorityA !== priorityB) return priorityA - priorityB;

    // 4. Sheet row order fallback (keeps manual row order stable within same category)
    const rowA = toFinite(a?.__rowIndex);
    const rowB = toFinite(b?.__rowIndex);
    if (rowA !== undefined && rowB !== undefined && rowA !== rowB) return rowA - rowB;

    // 5. Name fallback
    const nameA = getStreetDisplayName(a).toLowerCase();
    const nameB = getStreetDisplayName(b).toLowerCase();
    return nameA.localeCompare(nameB, 'en');
}

function toFinite(value) {
    const num = parseFloat(value);
    return Number.isFinite(num) ? num : undefined;
}

function clampFov(value) {
    return Math.min(120, Math.max(45, value));
}

// Utility functions
function getMostCommon(arr) {
    const counts = {};
    arr.forEach(item => {
        counts[item] = (counts[item] || 0) + 1;
    });
    
    let maxCount = 0;
    let mostCommon = arr[0];
    
    for (const item in counts) {
        if (counts[item] > maxCount) {
            maxCount = counts[item];
            mostCommon = item;
        }
    }
    
    return mostCommon;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getPopupLocationLabel(item) {
    if (!item) return '';
    const classroom = typeof item.classroomname === 'string' ? item.classroomname.trim() : '';
    const building = typeof item.building === 'string' ? item.building.trim() : '';
    const location = typeof item.location === 'string' ? item.location.trim() : '';
    if (classroom) return classroom;
    if (building && location && building !== location) {
        return `${building} ${location}`;
    }
    return building || location || item.title || '';
}

function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.remove();
}

function showError(message) {
    const banner = document.getElementById('error-banner');
    if (banner) {
        banner.textContent = message;
        banner.classList.add('show');
        setTimeout(() => banner.classList.remove('show'), 5000);
    }
}

function showStreetViewToast(text) {
    if (!text || !streetViewState.active) return;
    let toast = document.getElementById('streetview-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'streetview-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.classList.add('show');
    if (streetViewToastTimer) {
        clearTimeout(streetViewToastTimer);
    }
    streetViewToastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 5000);
}

function hideStreetViewToast() {
    const toast = document.getElementById('streetview-toast');
    if (toast) {
        toast.classList.remove('show');
    }
    if (streetViewToastTimer) {
        clearTimeout(streetViewToastTimer);
        streetViewToastTimer = 0;
    }
}

// Buildings restyle function
// 3D building restyle removed

// Initialize when data is ready
if (window.dataObject && window.dataObject.length > 0) {
    window.initmap();
}
