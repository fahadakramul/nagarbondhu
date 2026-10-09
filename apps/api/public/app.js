function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character])); }
function safePhotoUrl(value) { return /^https?:\/\//i.test(value || '') || /^\/uploads\/[\w.-]+$/.test(value || '') ? value : ''; }
// Global State
let currentTab = 'home';
let isAdminMode = false;
let authToken = null;
let allReports = [];
let dashboardData = null;

// Map & Layer State
let mainMap = null;
let pickerMap = null;
let pickerMarker = null;
let pickerAccuracyCircle = null;
let currentMarkerGroup = null;
let selectedReport = null;
let userOverrideCategory = null;

let pickerStreetLayer = null;
let pickerSatLayer = null;
let pickerSatLabels = null;

let mainStreetLayer = null;
let mainSatLayer = null;
let mainSatLabels = null;

// Photo Upload State
let selectedImageDataUrl = null;
let selectedImageFileName = '';

// Rajshahi Wards
const RAJSHAHI_WARDS = [
  { wardNumber: 1, wardName: 'ওয়ার্ড ০১ (কাজীহাটা - কোর্ট চত্বর)', lat: 24.3820, lng: 88.5895 },
  { wardNumber: 2, wardName: 'ওয়ার্ড ০২ (মহিষবাথান - রাজপাড়া)', lat: 24.3785, lng: 88.5760 },
  { wardNumber: 9, wardName: 'ওয়ার্ড ০৯ (বোয়ালিয়া - সাগরপাড়া)', lat: 24.3685, lng: 88.6015 },
  { wardNumber: 12, wardName: 'ওয়ার্ড ১২ (সাহেব বাজার - জিরো পয়েন্ট)', lat: 24.3636, lng: 88.6241 },
  { wardNumber: 14, wardName: 'ওয়ার্ড ১৪ (উপশহর - সেনানিবাস সংলগ্ন)', lat: 24.3752, lng: 88.6045 },
  { wardNumber: 21, wardName: 'ওয়ার্ড ২১ (শিরোইল - রেলওয়ে স্টেশন)', lat: 24.3735, lng: 88.6130 },
  { wardNumber: 25, wardName: 'ওয়ার্ড ২৫ (তালাইমারী - ভদ্রা)', lat: 24.3708, lng: 88.6368 },
  { wardNumber: 28, wardName: 'ওয়ার্ড ২৮ (মতিহার - রাজশাহী বিশ্ববিদ্যালয়)', lat: 24.3680, lng: 88.6430 },
  { wardNumber: 30, wardName: 'ওয়ার্ড ৩০ (বিনোদপুর - রুয়েট চত্বর)', lat: 24.3640, lng: 88.6480 },
];

const CATEGORY_NAMES_BN = {
  ROAD_DAMAGE: 'সড়ক ক্ষতি ও খানাখন্দ',
  WATERLOGGING: 'জলাবদ্ধতা ও পানি জমা',
  DRAINAGE: 'ড্রেনেজ ও নর্দমা',
  WASTE: 'বর্জ্য ও আবর্জনা',
  FOOTPATH: 'ভাঙা ফুটপাথ',
  STREETLIGHT: 'অচল সড়কবাতি',
  OTHER: 'অন্যান্য সমস্যা',
};

const CATEGORY_COLORS = {
  ROAD_DAMAGE: '#D97706',
  WATERLOGGING: '#0284C7',
  DRAINAGE: '#0D9488',
  WASTE: '#E11D48',
  FOOTPATH: '#7C3AED',
  STREETLIGHT: '#CA8A04',
  OTHER: '#64748B',
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  populateWardDropdown();
  populateOverrideButtons();
  initPickerMap();
  loadData();
});

// Tab Switcher
function switchTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-tab').forEach(el => {
    el.classList.remove('text-teal-400', 'bg-slate-800');
    el.classList.add('text-slate-300');
  });

  const targetSection = document.getElementById(`section-${tabId}`);
  if (targetSection) targetSection.classList.remove('hidden');

  const targetNav = document.getElementById(`tab-${tabId}`);
  if (targetNav) {
    targetNav.classList.remove('text-slate-300');
    targetNav.classList.add('text-teal-400', 'bg-slate-800');
  }

  if (tabId === 'report') {
    setTimeout(() => {
      if (pickerMap) pickerMap.invalidateSize();
    }, 150);
  }

  if (tabId === 'map') {
    setTimeout(() => {
      initMainMap();
      renderMapMarkers();
      if (mainMap) mainMap.invalidateSize();
    }, 150);
  }
}

// Populate Ward Dropdown
function populateWardDropdown() {
  const select = document.getElementById('form-ward');
  if (!select) return;
  select.innerHTML = '';
  RAJSHAHI_WARDS.forEach(w => {
    const opt = document.createElement('option');
    opt.value = w.wardNumber;
    opt.textContent = w.wardName;
    if (w.wardNumber === 12) opt.selected = true; // Shaheb Bazar by default
    select.appendChild(opt);
  });
}

function onWardSelect(wardNum) {
  const ward = RAJSHAHI_WARDS.find(w => w.wardNumber === parseInt(wardNum));
  if (ward && pickerMarker && pickerMap) {
    pickerMarker.setLatLng([ward.lat, ward.lng]);
    pickerMap.panTo([ward.lat, ward.lng]);
    document.getElementById('coords-display').textContent = `${ward.lat.toFixed(5)}, ${ward.lng.toFixed(5)}`;
    document.getElementById('form-address').value = `${ward.wardName}, রাজশাহী`;
  }
}

// Populate Category Override Pills
function populateOverrideButtons() {
  const container = document.getElementById('override-category-buttons');
  if (!container) return;
  container.innerHTML = '';
  Object.keys(CATEGORY_NAMES_BN).forEach(cat => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'text-[11px] bg-white border border-purple-300 text-purple-900 px-2.5 py-1 rounded-full hover:bg-purple-100 transition';
    btn.textContent = CATEGORY_NAMES_BN[cat];
    btn.onclick = () => {
      userOverrideCategory = cat;
      document.querySelectorAll('#override-category-buttons button').forEach(b => {
        b.classList.remove('bg-purple-700', 'text-white');
      });
      btn.classList.add('bg-purple-700', 'text-white');
    };
    container.appendChild(btn);
  });
}

// Helper: Update coordinates display and nearest ward
function updateLocationFromLatLng(lat, lng, accuracy = null) {
  const coordsEl = document.getElementById('coords-display');
  if (coordsEl) {
    coordsEl.textContent = accuracy 
      ? `${lat.toFixed(5)}, ${lng.toFixed(5)} (±${accuracy}m)`
      : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  // Find nearest Rajshahi Ward
  let closestWard = RAJSHAHI_WARDS[0];
  let minDist = 999999;
  RAJSHAHI_WARDS.forEach(w => {
    const d = Math.hypot(w.lat - lat, w.lng - lng);
    if (d < minDist) {
      minDist = d;
      closestWard = w;
    }
  });

  const select = document.getElementById('form-ward');
  if (select) select.value = closestWard.wardNumber;
  const addressInput = document.getElementById('form-address');
  if (addressInput && (!addressInput.value || addressInput.value.includes('রাজশাহী'))) {
    addressInput.value = `${closestWard.wardName}, রাজশাহী`;
  }
}

// Initialize Interactive Location Picker Mini-Map
function initPickerMap() {
  if (pickerMap) return;
  const initialLat = 24.3636;
  const initialLng = 88.6241;

  pickerMap = L.map('picker-map').setView([initialLat, initialLng], 15);

  pickerStreetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  });

  pickerSatLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19
  });

  pickerSatLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Labels &copy; Esri',
    maxZoom: 19
  });

  pickerStreetLayer.addTo(pickerMap);

  pickerMarker = L.marker([initialLat, initialLng], { draggable: true }).addTo(pickerMap);

  pickerMarker.on('dragend', function (e) {
    const latlng = e.target.getLatLng();
    updateLocationFromLatLng(latlng.lat, latlng.lng);
  });

  pickerMap.on('click', function (e) {
    pickerMarker.setLatLng(e.latlng);
    updateLocationFromLatLng(e.latlng.lat, e.latlng.lng);
  });

  setTimeout(() => {
    if (pickerMap) pickerMap.invalidateSize();
  }, 300);
}

// Toggle Picker Tile Layer (Street vs High-Res Satellite)
function setPickerTileLayer(mode) {
  if (!pickerMap) return;
  const btnStreet = document.getElementById('btn-tile-street');
  const btnSat = document.getElementById('btn-tile-satellite');

  if (mode === 'satellite') {
    if (pickerMap.hasLayer(pickerStreetLayer)) pickerMap.removeLayer(pickerStreetLayer);
    pickerSatLayer.addTo(pickerMap);
    pickerSatLabels.addTo(pickerMap);
    if (btnStreet) {
      btnStreet.className = 'text-[11px] font-semibold px-2.5 py-1 rounded-md text-slate-600 hover:bg-slate-100 transition';
    }
    if (btnSat) {
      btnSat.className = 'text-[11px] font-bold px-2.5 py-1 rounded-md bg-civic-700 text-white transition';
    }
  } else {
    if (pickerMap.hasLayer(pickerSatLayer)) pickerMap.removeLayer(pickerSatLayer);
    if (pickerMap.hasLayer(pickerSatLabels)) pickerMap.removeLayer(pickerSatLabels);
    pickerStreetLayer.addTo(pickerMap);
    if (btnStreet) {
      btnStreet.className = 'text-[11px] font-bold px-2.5 py-1 rounded-md bg-civic-700 text-white transition';
    }
    if (btnSat) {
      btnSat.className = 'text-[11px] font-semibold px-2.5 py-1 rounded-md text-slate-600 hover:bg-slate-100 transition';
    }
  }
}

// Live High-Precision GPS Tracker
function trackLiveLocation() {
  const btn = document.getElementById('btn-live-gps');
  if (!navigator.geolocation) {
    alert('আপনার ব্রাউজার বা ডিভাইসে জিপিএস লোকেশন সমর্থিত নয়।');
    return;
  }

  const originalContent = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> অবস্থান অনুসন্ধান হচ্ছে...`;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      btn.disabled = false;
      btn.innerHTML = originalContent;
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const accuracy = Math.round(pos.coords.accuracy || 10);

      if (pickerMap && pickerMarker) {
        pickerMarker.setLatLng([lat, lng]);
        pickerMap.flyTo([lat, lng], 17, { animate: true, duration: 1.2 });
        updateLocationFromLatLng(lat, lng, accuracy);

        if (pickerAccuracyCircle) {
          pickerMap.removeLayer(pickerAccuracyCircle);
        }
        pickerAccuracyCircle = L.circle([lat, lng], {
          radius: accuracy,
          color: '#0D9488',
          fillColor: '#14B8A6',
          fillOpacity: 0.2,
          weight: 1.5
        }).addTo(pickerMap);

        const statusMsg = document.getElementById('gps-status-msg');
        if (statusMsg) {
          statusMsg.innerHTML = `<span class="text-emerald-700 font-bold"><i class="fa-solid fa-circle-check"></i> লাইভ জিপিএস সংযোগ সফল! নির্ভুলতা: ±${accuracy} মিটার</span>`;
        }
      }
    },
    (err) => {
      btn.disabled = false;
      btn.innerHTML = originalContent;
      console.warn('Geolocation error:', err);
      const statusMsg = document.getElementById('gps-status-msg');
      if (statusMsg) {
        statusMsg.innerHTML = `<span class="text-rose-600 font-medium"><i class="fa-solid fa-triangle-exclamation"></i> জিপিএস সতর্কতা: ডিভাইসের লোকেশন পারমিশন চালু করুন।</span>`;
      }
      alert('ডিভাইসের লোকেশন পাওয়া যায়নি: ' + (err.message || 'অনুমতি প্রয়োজন'));
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

// Initialize Main Leaflet Problem Map
function initMainMap() {
  if (mainMap) {
    mainMap.invalidateSize();
    return;
  }

  mainMap = L.map('main-map').setView([24.3680, 88.6180], 13);
  
  mainStreetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors • NagarBondhu AI'
  });

  mainSatLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19
  });

  mainSatLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Labels &copy; Esri',
    maxZoom: 19
  });

  mainStreetLayer.addTo(mainMap);
  currentMarkerGroup = L.layerGroup().addTo(mainMap);

  setTimeout(() => {
    if (mainMap) mainMap.invalidateSize();
  }, 300);
}

// Toggle Main Map Tile Layer
function setMainTileLayer(mode) {
  if (!mainMap) return;
  const btnStreet = document.getElementById('btn-main-tile-street');
  const btnSat = document.getElementById('btn-main-tile-satellite');

  if (mode === 'satellite') {
    if (mainMap.hasLayer(mainStreetLayer)) mainMap.removeLayer(mainStreetLayer);
    mainSatLayer.addTo(mainMap);
    mainSatLabels.addTo(mainMap);
    if (btnStreet) {
      btnStreet.className = 'text-[11px] font-semibold px-2.5 py-1 rounded-md text-slate-600 hover:bg-slate-200 transition';
    }
    if (btnSat) {
      btnSat.className = 'text-[11px] font-bold px-2.5 py-1 rounded-md bg-civic-700 text-white transition';
    }
  } else {
    if (mainMap.hasLayer(mainSatLayer)) mainMap.removeLayer(mainSatLayer);
    if (mainMap.hasLayer(mainSatLabels)) mainMap.removeLayer(mainSatLabels);
    mainStreetLayer.addTo(mainMap);
    if (btnStreet) {
      btnStreet.className = 'text-[11px] font-bold px-2.5 py-1 rounded-md bg-civic-700 text-white transition';
    }
    if (btnSat) {
      btnSat.className = 'text-[11px] font-semibold px-2.5 py-1 rounded-md text-slate-600 hover:bg-slate-200 transition';
    }
  }
}

// Render Map Markers
function renderMapMarkers() {
  if (!mainMap || !currentMarkerGroup) return;
  currentMarkerGroup.clearLayers();

  const catFilter = document.getElementById('map-category-filter').value;
  const prioFilter = document.getElementById('map-priority-filter').value;

  allReports.forEach(r => {
    if (catFilter !== 'ALL' && r.category !== catFilter) return;
    const prioLevel = r.priorityAssessment?.priorityLevel || 'MEDIUM';
    if (prioFilter !== 'ALL' && prioLevel !== prioFilter) return;

    const color = CATEGORY_COLORS[r.category] || '#0F766E';

    // Custom HTML Marker Icon
    const customIcon = L.divIcon({
      className: 'custom-pin',
      html: `<div style="background-color: ${color}; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">📍</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const marker = L.marker([r.latitude, r.longitude], { icon: customIcon });

    const photoThumb = r.imageUrl ? `<img src="${escapeHtml(safePhotoUrl(r.imageUrl))}" alt="Photo" style="width: 100%; height: 80px; object-fit: cover; border-radius: 6px; margin-top: 6px;">` : '';

    const popupHtml = `
      <div class="p-2 space-y-1.5" style="min-width: 200px;">
        <span style="background-color: ${color}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: bold;">
          ${CATEGORY_NAMES_BN[r.category] || r.category}
        </span>
        <h4 style="font-weight: bold; font-size: 13px; margin-top: 4px; color: #0F172A;">${escapeHtml(r.title)}</h4>
        <p style="font-size: 11px; color: #64748B;">📍 ${escapeHtml(r.addressLabel || 'রাজশাহী')}</p>
        <p style="font-size: 11px; font-weight: bold; color: #D97706;">অগ্রাধিকার স্কোর: ${r.priorityAssessment?.score || 50}/১০০</p>
        ${photoThumb}
        <button onclick="openDetailModal('${r.id}')" style="margin-top: 8px; width: 100%; background-color: #0F766E; color: white; font-size: 11px; font-weight: bold; padding: 5px 8px; border-radius: 6px; border: none; cursor: pointer;">
          বিস্তারিত বিবরণ দেখুন
        </button>
      </div>
    `;

    marker.bindPopup(popupHtml);
    currentMarkerGroup.addLayer(marker);
  });
}

// Image File & Camera Handling
function handleFilePicked(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
    alert('অনুগ্রহ করে শুধুমাত্র ছবি ফাইল নির্বাচন করুন (JPG, PNG, WebP)।');
    return;
  }

  if (file.size > 4 * 1024 * 1024) {
    alert('ছবির আকার ৪ মেগাবাইটের কম হতে হবে।');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    selectedImageDataUrl = e.target.result;
    selectedImageFileName = file.name;

    const thumb = document.getElementById('image-preview-thumb');
    const nameEl = document.getElementById('image-preview-name');
    const sizeEl = document.getElementById('image-preview-size');
    const container = document.getElementById('image-preview-container');

    if (thumb) thumb.src = selectedImageDataUrl;
    if (nameEl) nameEl.textContent = file.name;
    if (sizeEl) sizeEl.textContent = `${(file.size / 1024).toFixed(1)} KB`;
    if (container) container.classList.remove('hidden');

    const formImg = document.getElementById('form-image');
    if (formImg) formImg.value = '';
  };
  reader.readAsDataURL(file);
}

function clearSelectedImage() {
  selectedImageDataUrl = null;
  selectedImageFileName = '';
  const cam = document.getElementById('camera-file-input');
  if (cam) cam.value = '';
  const gal = document.getElementById('gallery-file-input');
  if (gal) gal.value = '';
  const thumb = document.getElementById('image-preview-thumb');
  if (thumb) thumb.src = '';
  const container = document.getElementById('image-preview-container');
  if (container) container.classList.add('hidden');
}

function toggleUrlInput() {
  const box = document.getElementById('url-input-box');
  if (box) box.classList.toggle('hidden');
}

function onUrlImageChanged(val) {
  if (val && val.trim().startsWith('http')) {
    selectedImageDataUrl = null;
    const thumb = document.getElementById('image-preview-thumb');
    const nameEl = document.getElementById('image-preview-name');
    const sizeEl = document.getElementById('image-preview-size');
    const container = document.getElementById('image-preview-container');

    if (thumb) thumb.src = val.trim();
    if (nameEl) nameEl.textContent = 'অনলাইন ইমেজ লিঙ্ক';
    if (sizeEl) sizeEl.textContent = 'ওয়েব সোর্স';
    if (container) container.classList.remove('hidden');
  }
}

// Load Data from Backend REST API
async function loadData() {
  try {
    const [summaryRes, reportsRes] = await Promise.all([
      fetch('/api/v1/dashboard/summary').then(r => r.json()).catch(() => ({ success: false })),
      fetch('/api/v1/reports').then(r => r.json()).catch(() => ({ success: false }))
    ]);

    if (summaryRes.success && summaryRes.data) {
      dashboardData = summaryRes.data;
      updateHomeStats(summaryRes.data);
      renderDashboard(summaryRes.data);
    }

    if (reportsRes.success && reportsRes.reports) {
      allReports = reportsRes.reports;
      renderReportsFeed(reportsRes.reports);
      if (mainMap) renderMapMarkers();
      if (dashboardData) renderDashboard(dashboardData);
    }
    if (!summaryRes.success) ['stat-total','stat-open','stat-high','stat-resolved'].forEach(id => document.getElementById(id).textContent = 'তথ্য অনুপলব্ধ');
    if (!reportsRes.success) document.getElementById('reports-feed-container').textContent = 'রিপোর্ট লোড করা যায়নি। আবার চেষ্টা করুন।';
    if (isAdminMode && authToken) loadActionDashboard();
  } catch (err) {
    console.error('Data load error:', err);
  }
}

// Update Home KPI Cards
function updateHomeStats(data) {
  document.getElementById('stat-total').textContent = data.totalReports || 0;
  document.getElementById('stat-open').textContent = data.openReports || 0;
  document.getElementById('stat-high').textContent = (data.highPriorityReports || 0) + (data.criticalPriorityReports || 0);
  document.getElementById('stat-resolved').textContent = data.resolvedReports || 0;
}

// Render Reports Feed
function renderReportsFeed(reports) {
  const container = document.getElementById('reports-feed-container');
  container.innerHTML = '';

  if (!reports.length) container.textContent = 'এখনও কোনো রিপোর্ট নেই।';

  reports.forEach(r => {
    const color = CATEGORY_COLORS[r.category] || '#0F766E';
    const prioLevel = r.priorityAssessment?.priorityLevel || 'MEDIUM';
    const prioColor = prioLevel === 'CRITICAL' ? 'bg-red-100 text-red-700' : prioLevel === 'HIGH' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';

    const card = document.createElement('div');
    card.className = 'bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer space-y-2';
    card.onclick = () => openDetailModal(r.id);

    const photoHtml = r.imageUrl ? `
      <div class="mt-2 rounded-lg overflow-hidden border border-slate-200 max-h-48 bg-slate-100">
        <img src="${escapeHtml(safePhotoUrl(r.imageUrl))}" alt="Report photo" class="w-full h-40 object-cover hover:scale-105 transition duration-300">
      </div>
    ` : '';

    card.innerHTML = `
      <div class="flex justify-between items-center">
        <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-white" style="background-color: ${color}">
          ${CATEGORY_NAMES_BN[r.category] || r.category}
        </span>
        <span class="text-[11px] font-bold px-2 py-0.5 rounded-md ${prioColor}">
          স্কোর ${r.priorityAssessment?.score || 50} • ${prioLevel}
        </span>
      </div>
      <p class="text-[10px] text-slate-500">${r.sourceType === 'demo_seed' ? 'নমুনা রিপোর্ট (SAMPLE)' : 'নাগরিক রিপোর্ট'}</p><h3 class="text-sm font-bold text-slate-900 leading-snug">${escapeHtml(r.title)}</h3>
      <p class="text-xs text-slate-500 line-clamp-2">${escapeHtml(r.description)}</p>
      ${photoHtml}
      <div class="flex justify-between items-center text-[11px] text-slate-400 pt-2 border-t border-slate-100">
        <span>📍 ${escapeHtml(r.addressLabel || 'রাজশাহী')}</span>
        <span>${new Date(r.createdAt).toLocaleDateString('bn-BD')}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

// Render Dashboard View
function renderDashboard(data) {
  // Recommended Actions
  const recContainer = document.getElementById('dashboard-recommended-list');
  recContainer.innerHTML = '';
  data.recommendedActions.forEach(rec => {
    const item = document.createElement('div');
    item.className = 'bg-rose-50 border-l-4 border-rose-500 p-3 rounded-xl flex justify-between items-center gap-3';
    item.innerHTML = `
      <div>
        <h4 class="text-xs font-bold text-rose-900">${escapeHtml(rec.title)}</h4>
        <p class="text-[11px] text-rose-700 mt-0.5">💡 ${escapeHtml(rec.reason)}</p>
        <span class="text-[10px] text-rose-600">📍 ${escapeHtml(rec.location)}</span>
      </div>
      <span class="text-xs font-extrabold text-rose-700 bg-rose-200/60 px-2 py-1 rounded">স্কোর ${rec.score}</span>
    `;
    recContainer.appendChild(item);
  });

  // Category Distribution Bars
  const catBars = document.getElementById('dashboard-category-bars');
  catBars.innerHTML = '';
  data.byCategory.forEach(cat => {
    const color = CATEGORY_COLORS[cat.category] || '#0F766E';
    const div = document.createElement('div');
    div.className = 'space-y-1';
    div.innerHTML = `
      <div class="flex justify-between text-xs font-semibold text-slate-700">
        <span>${cat.categoryLabelBn}</span>
        <span>${cat.count}টি (${cat.percentage}%)</span>
      </div>
      <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
        <div style="width: ${Math.max(5, cat.percentage)}%; background-color: ${color};" class="h-full rounded-full"></div>
      </div>
    `;
    catBars.appendChild(div);
  });

  // Hotspots
  const hotspotsList = document.getElementById('dashboard-hotspots-list');
  hotspotsList.innerHTML = '';
  data.hotspots.forEach(h => {
    const div = document.createElement('div');
    div.className = 'bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center';
    div.innerHTML = `
      <div>
        <h4 class="text-xs font-bold text-slate-900">📍 ${escapeHtml(h.areaName)}</h4>
        <p class="text-[11px] text-slate-500 mt-0.5">প্রধান সমস্যা: ${CATEGORY_NAMES_BN[h.primaryCategory] || h.primaryCategory}</p>
      </div>
      <span class="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg">${h.reportCount}টি রিপোর্ট</span>
    `;
    hotspotsList.appendChild(div);
  });

  // Duplicates Queue
  const dupList = document.getElementById('dashboard-duplicates-list');
  dupList.innerHTML = '';
  const dups = allReports.filter(r => r.possibleDuplicates && r.possibleDuplicates.length > 0);
  if (dups.length === 0) {
    dupList.innerHTML = `<p class="text-xs text-slate-400">বর্তমানে কোনো অমীমাংসিত ডুপ্লিকেট নেই।</p>`;
  } else {
    dups.forEach(r => {
      r.possibleDuplicates.forEach(d => {
        const div = document.createElement('div');
        div.className = 'bg-purple-50 p-3 rounded-xl border border-purple-200 space-y-1.5';
        div.innerHTML = `
          <div class="flex justify-between items-center text-xs font-bold text-purple-900">
            <span>${escapeHtml(r.title)}</span>
            <span class="bg-purple-200 text-purple-800 px-2 py-0.5 rounded text-[10px]">সাদৃশ্য ${Math.round(d.similarityScore * 100)}%</span>
          </div>
          <p class="text-[11px] text-purple-800">${escapeHtml(d.matchingReasons.distanceExplanation)} | ${escapeHtml(d.matchingReasons.textMatchExplanation)}</p>
          ${isAdminMode && d.reviewStatus === 'PENDING' ? `
            <div class="flex gap-2 pt-1">
              <button onclick="reviewDuplicate('${d.id}', 'CONFIRMED_DUPLICATE')" class="bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded hover:bg-emerald-700">✓ ডুপ্লিকেট নিশ্চিত</button>
              <button onclick="reviewDuplicate('${d.id}', 'DISMISSED')" class="bg-rose-600 text-white text-[10px] font-bold px-2.5 py-1 rounded hover:bg-rose-700">✕ বাতিল</button>
            </div>
          ` : `<span class="text-[10px] text-purple-700 font-semibold">স্ট্যাটাস: ${d.reviewStatus}</span>`}
        `;
        dupList.appendChild(div);
      });
    });
  }
}

// Live AI Analysis Preview
async function runAiPreview() {
  const desc = document.getElementById('form-description').value.trim();
  if (!desc) {
    alert('অনুগ্রহ করে আগে সমস্যার বর্ণনা লিখুন।');
    return;
  }

  const btn = document.getElementById('btn-ai-preview');
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> এআই বিশ্লেষণ হচ্ছে...`;

  try {
    const res = await fetch('/api/v1/ai/analyze-complaint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: desc })
    });
    const result = await res.json();

    if (result.success && result.data) {
      const data = result.data;
      document.getElementById('ai-preview-box').classList.remove('hidden');
      document.getElementById('ai-preview-category-badge').textContent = CATEGORY_NAMES_BN[data.category] || data.category;
      document.getElementById('ai-preview-summary').textContent = data.summary;
      document.getElementById('ai-preview-severity').textContent = data.severity;
      document.getElementById('ai-preview-confidence').textContent = Math.round((data.confidence || 0.88) * 100);

      const reasonsList = document.getElementById('ai-preview-reasons');
      reasonsList.innerHTML = '';
      data.reasons.forEach(r => {
        const li = document.createElement('li');
        li.textContent = r;
        reasonsList.appendChild(li);
      });

      // Auto-fill title if empty
      const titleInput = document.getElementById('form-title');
      if (!titleInput.value) {
        titleInput.value = data.summary.slice(0, 45);
      }
    }
  } catch (e) {
    alert('এআই বিশ্লেষণ চালানো যায়নি।');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> ✨ এআই বিশ্লেষণ চালান (AI Preview)`;
  }
}

// Form Submission with Custom Image Upload
async function handleFormSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('form-title').value.trim();
  const desc = document.getElementById('form-description').value.trim();
  const wardNum = document.getElementById('form-ward').value;
  const addressLabel = document.getElementById('form-address').value.trim();
  const rawUrl = document.getElementById('form-image') ? document.getElementById('form-image').value.trim() : '';
  const latlng = pickerMarker ? pickerMarker.getLatLng() : { lat: 24.3636, lng: 88.6241 };

  const submitBtn = document.getElementById('btn-submit-report');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> আপলোড ও প্রসেসিং হচ্ছে...`;

  try {
    let finalImageUrl = rawUrl || null;

    // If an image was taken with camera or uploaded from device, send to upload endpoint
    if (selectedImageDataUrl) {
      try {
        const uploadRes = await fetch('/api/v1/reports/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: selectedImageDataUrl })
        });
        const uploadResult = await uploadRes.json();
        if (uploadResult.success && uploadResult.imageUrl) {
          finalImageUrl = uploadResult.imageUrl;
        }
      } catch (uploadErr) {
        console.warn('Image upload error:', uploadErr);
      }
    }

    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch('/api/v1/reports', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title,
        description: desc,
        userCategory: userOverrideCategory || undefined,
        latitude: latlng.lat,
        longitude: latlng.lng,
        addressLabel,
        wardId: `ward-${wardNum}`,
        imageUrl: finalImageUrl
      })
    });

    const result = await res.json();
    if (result.success) {
      alert(`অভিনন্দন! আপনার রিপোর্ট সফলভাবে জমা হয়েছে।\nএআই ক্যাটাগরি: ${CATEGORY_NAMES_BN[result.report.category] || result.report.category}\nনির্ধারিত প্রায়োরিটি স্কোর: ${result.report.priorityAssessment?.score || 50}/১০০`);
      document.getElementById('report-form').reset();
      clearSelectedImage();
      document.getElementById('ai-preview-box').classList.add('hidden');
      userOverrideCategory = null;
      loadData();
      switchTab('feed');
    } else {
      alert(result.error || 'রিপোর্ট জমা দেওয়া সম্ভব হয়নি।');
    }
  } catch (err) {
    alert('সার্ভারে সংযোগ ব্যর্থ হয়েছে।');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> রিপোর্ট জমা দিন (Submit Report)`;
  }
}

// Open Detail Modal
function openDetailModal(reportId) {
  const r = allReports.find(x => x.id === reportId);
  if (!r) return;
  selectedReport = r;

  document.getElementById('modal-title').textContent = r.title;
  document.getElementById('modal-location').textContent = `📍 ${escapeHtml(r.addressLabel || 'রাজশাহী')}`;
  document.getElementById('modal-description').textContent = r.description;
  document.getElementById('modal-category').textContent = CATEGORY_NAMES_BN[r.category] || r.category;
  document.getElementById('modal-status').textContent = r.status;

  // Image in modal
  const imgContainer = document.getElementById('modal-image-container');
  const imgEl = document.getElementById('modal-image');
  if (r.imageUrl) {
    if (imgEl) imgEl.src = r.imageUrl;
    if (imgContainer) imgContainer.classList.remove('hidden');
  } else {
    if (imgContainer) imgContainer.classList.add('hidden');
    if (imgEl) imgEl.src = '';
  }

  // AI Box
  document.getElementById('modal-ai-summary').textContent = 'বিশ্লেষণ পাওয়া যায়নি';
  document.getElementById('modal-ai-severity').textContent = 'অনুপলব্ধ';
  document.getElementById('modal-ai-reasons').textContent = '';
  if (r.aiAnalysis) {
    document.getElementById('modal-ai-summary').textContent = r.aiAnalysis.summary;
    document.getElementById('modal-ai-severity').textContent = r.aiAnalysis.severity;
    const reasonsEl = document.getElementById('modal-ai-reasons');
    reasonsEl.innerHTML = '';
    (r.aiAnalysis.reasons || []).forEach(reason => {
      const li = document.createElement('li');
      li.textContent = reason;
      reasonsEl.appendChild(li);
    });
  }

  // Priority Box
  document.getElementById('modal-prio-score').textContent = 'অনুপলব্ধ';
  document.getElementById('modal-prio-summary').textContent = 'অগ্রাধিকার মূল্যায়ন পাওয়া যায়নি';
  if (r.priorityAssessment) {
    document.getElementById('modal-prio-score').textContent = r.priorityAssessment.score;
    document.getElementById('modal-prio-summary').textContent = r.priorityAssessment.explanation?.summary || 'অগ্রাধিকার মূল্যায়ন সম্পন্ন';
  }

  // Admin controls
  const adminBox = document.getElementById('modal-admin-controls');
  if (isAdminMode) {
    adminBox.classList.remove('hidden');
    loadReportActions(reportId);
  } else {
    adminBox.classList.add('hidden');
  }

  document.getElementById('report-modal').classList.remove('hidden');
}

function closeDetailModal() {
  document.getElementById('report-modal').classList.add('hidden');
  selectedReport = null;
}

// Toggle Role (Citizen <-> Admin / Urban Planner)
async function toggleUserRole() {
  isAdminMode = !isAdminMode;
  const roleText = document.getElementById('role-text');
  const roleIcon = document.getElementById('role-icon');
  const toggleBtn = document.getElementById('role-toggle-btn');

  if (isAdminMode) {
    roleIcon.textContent = '🛡️';
    roleText.textContent = 'অ্যাডমিন / প্ল্যানার';
    toggleBtn.className = 'flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow transition';

    // Auto-login as demo admin
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@nagarbondhu.gov.bd', password: 'DemoAdmin123!' })
      });
      const data = await res.json();
      if (data.token) authToken = data.token;
    } catch (e) {}
  } else {
    roleIcon.textContent = '👤';
    roleText.textContent = 'সাধারণ নাগরিক';
    toggleBtn.className = 'flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow transition';
    authToken = null;
  }

  loadData();
  document.getElementById('admin-action-dashboard').classList.toggle('hidden', !isAdminMode);
  if (selectedReport) openDetailModal(selectedReport.id);
}

// Admin Status Update
async function updateReportStatus(newStatus) {
  if (!selectedReport || !authToken) return;
  try {
    const res = await fetch(`/api/v1/admin/reports/${selectedReport.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ status: newStatus, note: 'ওয়েব ড্যাশবোর্ড থেকে স্ট্যাটাস পরিবর্তন' })
    });
    const data = await res.json();
    if (data.success) {
      alert(`স্ট্যাটাস সফলভাবে পরিবর্তিত হয়েছে: ${newStatus}`);
      closeDetailModal();
      loadData();
    }
  } catch (e) {
    alert('স্ট্যাটাস আপডেট ব্যর্থ');
  }
}

// Admin Duplicate Review
async function reviewDuplicate(dupId, reviewStatus) {
  if (!authToken) return;
  try {
    const res = await fetch(`/api/v1/duplicates/${dupId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ reviewStatus })
    });
    const data = await res.json();
    if (data.success) {
      alert(reviewStatus === 'CONFIRMED_DUPLICATE' ? 'ডুপ্লিকেট নিশ্চিত করা হয়েছে' : 'ডুপ্লিকেট বাতিল করা হয়েছে');
      loadData();
    }
  } catch (e) {
    alert('ডুপ্লিকেট পর্যালোচনা ব্যর্থ');
  }
}
