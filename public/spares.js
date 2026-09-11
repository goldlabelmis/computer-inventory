// Local Storage Backup & API Endpoint Configuration
const SPARES_API_URL = '/api/spares';
const AUTH_KEY = 'is_admin_logged_in';

let sparePartsList = [];
let currentCategory = 'ALL';
let currentColorFilter = null;

// Initialize Page Data
document.addEventListener('DOMContentLoaded', () => {
  loadSpareParts();
  checkAdminAuth();
  setupEventListeners();
});

// Load Spares from MongoDB API
async function loadSpareParts() {
  try {
    const response = await fetch(SPARES_API_URL);
    if (response.ok) {
      const data = await response.json();
      sparePartsList = data.map(item => ({
        id: item._id,
        type: item.item_type || item.type,
        brand: item.brand,
        model: item.model,
        specs: item.specs,
        serial: item.serial_number || item.serial,
        color: item.color || '',
        quantity: item.quantity !== undefined ? item.quantity : 1,
        status: item.status || 'Available'
      }));
    } else {
      console.warn('Backend API unavailable. Falling back to local state.');
    }
  } catch (err) {
    console.error('Error fetching spare parts:', err);
  } finally {
    renderSpareCards();
    updateAnalytics();
  }
}

// Admin Authentication UI Check - Auto-Admin Mode Enabled
function checkAdminAuth() {
  localStorage.setItem(AUTH_KEY, 'true');
  document.body.classList.add('is-admin');

  const userInfo = document.getElementById('user-info');
  if (userInfo) {
    userInfo.innerHTML = '';
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
        <p style="color: var(--text-muted, #6c757d); text-align: center; margin: 0;">No spare parts found.</p>
      </div>`;
    return;
  }

  dataToRender.forEach(item => {
    const card = document.createElement('div');
    card.className = 'device-card';

    let badgeClass = 'badge-available';
    if (item.status === 'In Use') badgeClass = 'badge-inuse';
    if (item.status === 'Defective') badgeClass = 'badge-defective';

    const isInk = (item.type || '').toLowerCase() === 'ink';
    const colorBadge = isInk && item.color ? `<span class="badge badge-info" style="background-color: #6c757d; margin-left: 5px;">${escapeHTML(item.color)}</span>` : '';

    // Dynamic Columns: Bottle Quantity for Ink vs Specs/Serial for Hardware
    const detailColumns = isInk ? `
      <div class="meta-item">
        <label>BOTTLE QUANTITY</label>
        <span>${item.quantity} Bottle(s)</span>
      </div>
      <div class="meta-item"><label>STATUS</label><span class="badge ${badgeClass}">${escapeHTML(item.status)}</span></div>
    ` : `
      <div class="meta-item"><label>SPECIFICATIONS</label><span>${escapeHTML(item.specs || 'N/A')}</span></div>
      <div class="meta-item"><label>SERIAL NUMBER</label><span>${escapeHTML(item.serial || 'N/A')}</span></div>
      <div class="meta-item"><label>STATUS</label><span class="badge ${badgeClass}">${escapeHTML(item.status)}</span></div>
    `;

    // Only render the "- 0.5" button between Edit and Delete if the item is Ink
    const deductButton = isInk ? `
      <button class="btn btn-danger btn-sm" style="background-color: #ef476f; border: none; color: white; font-weight: bold;" onclick="consumeInk('${item.id}', ${item.quantity})" title="Deduct 0.5 bottle">- 0.5</button>
    ` : '';

    card.innerHTML = `
      <div class="device-meta" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <div class="meta-item"><label>TYPE</label><span>${escapeHTML(item.type)} ${colorBadge}</span></div>
        <div class="meta-item"><label>BRAND & MODEL</label><span>${escapeHTML(item.brand)} ${escapeHTML(item.model)}</span></div>
        ${detailColumns}
        <div class="card-actions admin-only" style="display: flex; gap: 8px; align-items: center;">
          <button class="btn btn-warning btn-sm" style="background-color: #fca311; border: none; color: white;" onclick="editSparePart('${item.id}')">✏️ Edit</button>
          ${deductButton}
          <button class="btn btn-danger btn-sm" style="background-color: #ef476f; border: none; color: white;" onclick="deleteSparePart('${item.id}')">Delete Unit</button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

// Deduct 0.5 bottle of ink quick action (Includes float precision rounding)
async function consumeInk(id, currentQty) {
  const targetItem = sparePartsList.find(i => i.id === id);
  if (!targetItem) return;

  // Rounding prevents JS floating-point arithmetic errors (e.g. 1.0 - 0.5 = 0.4999999)
  const rawQty = Math.max(0, currentQty - 0.5);
  const newQty = parseFloat(rawQty.toFixed(2));

  const payload = {
    item_type: targetItem.type,
    brand: targetItem.brand,
    model: targetItem.model,
    color: targetItem.color,
    quantity: newQty,
    specs: targetItem.specs || '',
    serial_number: targetItem.serial || '',
    status: newQty === 0 ? 'Defective' : targetItem.status
  };

  try {
    const res = await fetch(`${SPARES_API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      await loadSpareParts();
    } else {
      alert('Failed to update ink level.');
    }
  } catch (err) {
    console.error('Consume Ink Error:', err);
  }
}

// Get Filtered Data
function getFilteredData() {
  const searchTerm = document.getElementById('search-spare-input')?.value.toLowerCase() || '';

  return sparePartsList.filter(item => {
    const matchesCategory = currentCategory === 'ALL' || (item.type || '').toUpperCase() === currentCategory.toUpperCase();
    const matchesColor = !currentColorFilter || (item.color || '').toLowerCase() === currentColorFilter.toLowerCase();
    
    const matchesSearch = 
      (item.type || '').toLowerCase().includes(searchTerm) ||
      (item.brand || '').toLowerCase().includes(searchTerm) ||
      (item.model || '').toLowerCase().includes(searchTerm) ||
      (item.serial || '').toLowerCase().includes(searchTerm) ||
      (item.color || '').toLowerCase().includes(searchTerm);

    return matchesCategory && matchesColor && matchesSearch;
  });
}

// Main Category Filtering
function filterSpareCategory(category, element) {
  currentCategory = category;
  currentColorFilter = null;
  
  document.querySelectorAll('#spare-category-sidebar li').forEach(li => li.classList.remove('active'));
  if (element) element.classList.add('active');

  renderSpareCards();
}

// Subcategory Ink Color Filtering
function filterInkColor(color, element) {
  currentCategory = 'Ink';
  currentColorFilter = color;

  document.querySelectorAll('#spare-category-sidebar li').forEach(li => li.classList.remove('active'));
  if (element) element.classList.add('active');

  renderSpareCards();
}

// Update Analytics Summary Widgets
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

// Toggle Fields: Shows Quantity & Ink Color for Ink, Serial & Specs for Hardware
function toggleFormFieldsForType() {
  const typeSelect = document.getElementById('spare-type');
  const colorGroup = document.getElementById('ink-color-group');
  const quantityGroup = document.getElementById('ink-quantity-group');
  const standardFields = document.getElementById('standard-fields-group');

  if (typeSelect && typeSelect.value.toLowerCase() === 'ink') {
    if (colorGroup) colorGroup.style.display = 'block';
    if (quantityGroup) quantityGroup.style.display = 'block';
    if (standardFields) standardFields.style.display = 'none';
  } else {
    if (colorGroup) {
      colorGroup.style.display = 'none';
      document.getElementById('spare-color').value = '';
    }
    if (quantityGroup) {
      quantityGroup.style.display = 'none';
      document.getElementById('spare-quantity').value = '1';
    }
    if (standardFields) standardFields.style.display = 'block';
  }
}

// Setup Event Listeners
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

// Open Add Modal
function openAddSpareModal() {
  document.getElementById('spare-modal-title').textContent = 'Add Spare Part';
  document.getElementById('spare-id').value = '';
  document.getElementById('add-spare-form').reset();
  toggleFormFieldsForType();
  openModal('spare-modal');
}

// Open Edit Modal
function editSparePart(id) {
  const item = sparePartsList.find(i => i.id === id);
  if (!item) return;

  document.getElementById('spare-modal-title').textContent = 'Edit Spare Part';
  document.getElementById('spare-id').value = item.id;
  document.getElementById('spare-type').value = item.type;
  document.getElementById('spare-brand').value = item.brand || '';
  document.getElementById('spare-model').value = item.model || '';
  document.getElementById('spare-status').value = item.status;
  
  toggleFormFieldsForType();

  if (item.type.toLowerCase() === 'ink') {
    if (document.getElementById('spare-color')) document.getElementById('spare-color').value = item.color || '';
    if (document.getElementById('spare-quantity')) document.getElementById('spare-quantity').value = item.quantity !== undefined ? item.quantity : 1;
  } else {
    if (document.getElementById('spare-specs')) document.getElementById('spare-specs').value = item.specs || '';
    if (document.getElementById('spare-serial')) document.getElementById('spare-serial').value = item.serial || '';
  }

  openModal('spare-modal');
}

// Save Item API Request
async function handleSaveSpare(e) {
  e.preventDefault();

  const id = document.getElementById('spare-id').value;
  const isInk = document.getElementById('spare-type').value.toLowerCase() === 'ink';

  const payload = {
    item_type: document.getElementById('spare-type').value,
    brand: document.getElementById('spare-brand').value,
    model: document.getElementById('spare-model').value,
    status: document.getElementById('spare-status').value,
    color: isInk ? document.getElementById('spare-color').value : '',
    quantity: isInk ? parseFloat(document.getElementById('spare-quantity').value) || 1 : 1,
    specs: isInk ? '' : document.getElementById('spare-specs').value,
    serial_number: isInk ? '' : document.getElementById('spare-serial').value
  };

  try {
    const url = id ? `${SPARES_API_URL}/${id}` : SPARES_API_URL;
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      await loadSpareParts();
      closeModal('spare-modal');
    } else {
      const err = await res.json();
      alert(`Error saving item: ${err.error || 'Server error'}`);
    }
  } catch (err) {
    console.error('Save Spare Error:', err);
    alert('Failed to save spare item.');
  }
}

// Delete Item
async function deleteSparePart(id) {
  if (confirm('Are you sure you want to delete this spare part unit?')) {
    try {
      const res = await fetch(`${SPARES_API_URL}/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await loadSpareParts();
      } else {
        alert('Failed to delete item from server.');
      }
    } catch (err) {
      console.error('Delete Spare Error:', err);
    }
  }
}

// Helper Functions
function openModal(modalId) {
  document.getElementById(modalId)?.classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId)?.classList.remove('active');
}

function escapeHTML(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}