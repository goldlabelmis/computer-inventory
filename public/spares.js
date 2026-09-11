// Local Storage Keys
const SPARES_STORAGE_KEY = 'spare_inventory_items';
const AUTH_KEY = 'is_admin_logged_in';

// Default Demo Data
const defaultSpareParts = [
  { id: '1', type: 'RAM', brand: 'Kingston', model: 'Fury Beast 8GB', specs: 'DDR4 3200MHz', serial: 'SN-RAM-9081', status: 'Available' },
  { id: '2', type: 'Storage', brand: 'Samsung', model: '970 EVO Plus', specs: '500GB NVMe M.2', serial: 'SN-SSD-4412', status: 'In Use' },
  { id: '3', type: 'GPU', brand: 'ASUS', model: 'GTX 1650', specs: '4GB GDDR6', serial: 'SN-GPU-8821', status: 'Available' },
  { id: '4', type: 'Peripherals', brand: 'Logitech', model: 'K120', specs: 'USB Wired Keyboard', serial: 'SN-KB-1029', status: 'Defective' }
];

let sparePartsList = [];
let currentCategory = 'ALL';

// Initialize Page Data
document.addEventListener('DOMContentLoaded', () => {
  loadSpareParts();
  checkAdminAuth();
  setupEventListeners();
  renderSpareCards();
  updateAnalytics();
});

// Load Spares from LocalStorage
function loadSpareParts() {
  const stored = localStorage.getItem(SPARES_STORAGE_KEY);
  if (stored) {
    sparePartsList = JSON.parse(stored);
  } else {
    sparePartsList = [...defaultSpareParts];
    saveToStorage();
  }
}

function saveToStorage() {
  localStorage.setItem(SPARES_STORAGE_KEY, JSON.stringify(sparePartsList));
}

// Admin Authentication UI Check
function checkAdminAuth() {
  const isAdmin = localStorage.getItem(AUTH_KEY) === 'true';
  if (isAdmin) {
    document.body.classList.add('is-admin');
    document.getElementById('user-info').innerHTML = '<span>Logged in as: <strong>Admin</strong></span>';
  } else {
    document.body.classList.remove('is-admin');
    document.getElementById('user-info').innerHTML = '<span>View Only Mode</span>';
  }
}

// Render Cards Dynamic View
function renderSpareCards(dataToRender = getFilteredData()) {
  const container = document.getElementById('spare-parts-container');
  if (!container) return;

  container.innerHTML = '';

  if (dataToRender.length === 0) {
    container.innerHTML = `
      <div class="device-card">
        <p style="color: var(--text-muted); text-align: center;">No spare parts found.</p>
      </div>`;
    return;
  }

  dataToRender.forEach(item => {
    const card = document.createElement('div');
    card.className = 'device-card';

    let badgeClass = 'badge-available';
    if (item.status === 'In Use') badgeClass = 'badge-inuse';
    if (item.status === 'Defective') badgeClass = 'badge-defective';

    card.innerHTML = `
      <div class="device-meta">
        <div class="meta-item"><label>Type</label><span>${escapeHTML(item.type)}</span></div>
        <div class="meta-item"><label>Brand & Model</label><span>${escapeHTML(item.brand)} ${escapeHTML(item.model)}</span></div>
        <div class="meta-item"><label>Specifications</label><span>${escapeHTML(item.specs || 'N/A')}</span></div>
        <div class="meta-item"><label>Serial Number</label><span>${escapeHTML(item.serial || 'N/A')}</span></div>
        <div class="meta-item"><label>Status</label><span class="badge ${badgeClass}">${escapeHTML(item.status)}</span></div>
        <div class="card-actions admin-only">
          <button class="btn btn-warning btn-sm" onclick="editSparePart('${item.id}')">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteSparePart('${item.id}')">Delete</button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

// Get Filtered Data by Category & Search
function getFilteredData() {
  const searchTerm = document.getElementById('search-spare-input')?.value.toLowerCase() || '';

  return sparePartsList.filter(item => {
    const matchesCategory = currentCategory === 'ALL' || item.type.toUpperCase() === currentCategory.toUpperCase();
    const matchesSearch = 
      item.type.toLowerCase().includes(searchTerm) ||
      item.brand.toLowerCase().includes(searchTerm) ||
      item.model.toLowerCase().includes(searchTerm) ||
      item.serial.toLowerCase().includes(searchTerm);

    return matchesCategory && matchesSearch;
  });
}

// Category Filtering
function filterSpareCategory(category, element) {
  currentCategory = category;
  
  // Highlight sidebar element
  document.querySelectorAll('#spare-category-sidebar li').forEach(li => li.classList.remove('active'));
  if (element) element.classList.add('active');

  renderSpareCards();
}

// Update Top Analytics Widgets
function updateAnalytics() {
  const total = sparePartsList.length;
  const available = sparePartsList.filter(i => i.status === 'Available').length;
  const inUse = sparePartsList.filter(i => i.status === 'In Use').length;
  const defective = sparePartsList.filter(i => i.status === 'Defective').length;

  if (document.getElementById('stat-total-spares')) document.getElementById('stat-total-spares').textContent = total;
  if (document.getElementById('stat-available-spares')) document.getElementById('stat-available-spares').textContent = available;
  if (document.getElementById('stat-inuse-spares')) document.getElementById('stat-inuse-spares').textContent = inUse;
  if (document.getElementById('stat-defective-spares')) document.getElementById('stat-defective-spares').textContent = defective;
}

// Event Listeners Setup
function setupEventListeners() {
  const searchInput = document.getElementById('search-spare-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderSpareCards());
  }

  const form = document.getElementById('add-spare-form');
  if (form) {
    form.addEventListener('submit', handleSaveSpare);
  }
}

// Add/Edit Part Functions
function openAddSpareModal() {
  document.getElementById('spare-modal-title').textContent = 'Add Spare Part';
  document.getElementById('spare-id').value = '';
  document.getElementById('add-spare-form').reset();
  openModal('spare-modal');
}

function editSparePart(id) {
  const item = sparePartsList.find(i => i.id === id);
  if (!item) return;

  document.getElementById('spare-modal-title').textContent = 'Edit Spare Part';
  document.getElementById('spare-id').value = item.id;
  document.getElementById('spare-type').value = item.type;
  document.getElementById('spare-brand').value = item.brand;
  document.getElementById('spare-model').value = item.model;
  document.getElementById('spare-specs').value = item.specs;
  document.getElementById('spare-serial').value = item.serial;
  document.getElementById('spare-status').value = item.status;

  openModal('spare-modal');
}

function handleSaveSpare(e) {
  e.preventDefault();

  const id = document.getElementById('spare-id').value;
  const spareData = {
    id: id || Date.now().toString(),
    type: document.getElementById('spare-type').value,
    brand: document.getElementById('spare-brand').value,
    model: document.getElementById('spare-model').value,
    specs: document.getElementById('spare-specs').value,
    serial: document.getElementById('spare-serial').value,
    status: document.getElementById('spare-status').value
  };

  if (id) {
    const index = sparePartsList.findIndex(i => i.id === id);
    if (index !== -1) sparePartsList[index] = spareData;
  } else {
    sparePartsList.push(spareData);
  }

  saveToStorage();
  renderSpareCards();
  updateAnalytics();
  closeModal('spare-modal');
}

function deleteSparePart(id) {
  if (confirm('Are you sure you want to delete this spare part?')) {
    sparePartsList = sparePartsList.filter(i => i.id !== id);
    saveToStorage();
    renderSpareCards();
    updateAnalytics();
  }
}

// Modal Toggle Helpers
function openModal(modalId) {
  document.getElementById(modalId)?.classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId)?.classList.remove('active');
}

// Escape HTML for XSS prevention
function escapeHTML(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}