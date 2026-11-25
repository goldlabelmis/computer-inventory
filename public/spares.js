// Local Storage Backup & API Endpoint Configuration
const SPARES_API_URL = '/api/spares';
const AUTH_KEY = 'is_admin_logged_in';
const DEFAULT_PERIPHERALS = ['Power Cord', 'SATA Cable', 'Printer Cord'];
const CUSTOM_PERIPHERALS_KEY = 'custom_peripheral_types';

let sparePartsList = [];
let currentCategory = 'ALL';
let currentColorFilter = null;
let isRefillHistoryVisible = false; // Toggle state for refill history view
let isCustomPeripheralMode = false; // Toggle state for custom peripheral input

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
        brand: item.brand || '',
        model: item.model || '',
        specs: item.specs || '',
        serial: item.serial_number || item.serial || '',
        color: item.color || '',
        peripheralType: item.peripheral_type || item.peripheralType || '',
        quantity: item.quantity !== undefined ? item.quantity : 1,
        status: item.status || 'Available',
        refillHistory: item.refillHistory || []
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

// Custom Peripheral Storage Helpers
function getCustomPeripherals() {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOM_PERIPHERALS_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveCustomPeripherals(list) {
  localStorage.setItem(CUSTOM_PERIPHERALS_KEY, JSON.stringify(list));
}

function refreshPeripheralSelectOptions(selectedValue = '') {
  const select = document.getElementById('peripheral-select');
  if (!select) return;

  const customList = getCustomPeripherals();
  const allOptions = [...DEFAULT_PERIPHERALS];

  customList.forEach(name => {
    if (!allOptions.some(opt => opt.toLowerCase() === name.toLowerCase())) {
      allOptions.push(name);
    }
  });

  if (selectedValue && !allOptions.some(opt => opt.toLowerCase() === selectedValue.toLowerCase())) {
    allOptions.push(selectedValue);
  }

  select.innerHTML = `<option value="">Select Peripheral...</option>` +
    allOptions.map(opt => `<option value="${escapeHTML(opt)}">${escapeHTML(opt)}</option>`).join('');

  if (selectedValue) {
    select.value = selectedValue;
  }
}

function toggleCustomPeripheralInput(forceState = null) {
  const customRow = document.getElementById('custom-peripheral-row');
  const customInput = document.getElementById('peripheral-custom-input');
  if (!customRow || !customInput) return;

  isCustomPeripheralMode = forceState !== null ? forceState : !isCustomPeripheralMode;

  if (isCustomPeripheralMode) {
    customRow.style.display = 'flex';
    customInput.focus();
  } else {
    customRow.style.display = 'none';
    customInput.value = '';
  }
}

function addCustomPeripheralToSelect() {
  const customInput = document.getElementById('peripheral-custom-input');
  const select = document.getElementById('peripheral-select');
  if (!customInput || !select) return;

  const newName = customInput.value.trim();
  if (!newName) {
    alert('Please enter a peripheral name first.');
    return false;
  }

  const existingDefault = DEFAULT_PERIPHERALS.find(p => p.toLowerCase() === newName.toLowerCase());
  const finalName = existingDefault || newName;

  if (!existingDefault) {
    const customList = getCustomPeripherals();
    if (!customList.some(p => p.toLowerCase() === newName.toLowerCase())) {
      customList.push(newName);
      saveCustomPeripherals(customList);
    }
  }

  refreshPeripheralSelectOptions(finalName);
  select.value = finalName;
  toggleCustomPeripheralInput(false);
  return true;
}

function deleteSelectedPeripheralOption() {
  const select = document.getElementById('peripheral-select');
  if (!select) return;

  const currentVal = select.value;
  if (!currentVal) {
    return alert('Please select a custom peripheral option to delete.');
  }

  if (DEFAULT_PERIPHERALS.some(p => p.toLowerCase() === currentVal.toLowerCase())) {
    return alert(`"${currentVal}" is a default peripheral and cannot be deleted.`);
  }

  if (!confirm(`Delete "${currentVal}" from the Peripheral Type list?`)) return;

  const updatedCustom = getCustomPeripherals().filter(
    p => p.toLowerCase() !== currentVal.toLowerCase()
  );
  saveCustomPeripherals(updatedCustom);
  refreshPeripheralSelectOptions('');
}

function handlePeripheralSelectChange() {
  const selectInput = document.getElementById('peripheral-select');
  if (selectInput && selectInput.value) {
    toggleCustomPeripheralInput(false);
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

    const itemTypeLower = (item.type || '').toLowerCase();
    const isInk = itemTypeLower === 'ink';
    const isPeripheral = itemTypeLower === 'peripherals';
    const hasQuantity = isInk || isPeripheral || ['ram', 'storage'].includes(itemTypeLower);
    
    // Dynamic Ink Color Styling with Enhanced Contrast for Yellow
    let inkBgColor = '#6c757d';
    let textShadowStyle = '';
    const inkColorLower = (item.color || '').toLowerCase();

    if (inkColorLower === 'black') {
      inkBgColor = '#212529';
    } else if (inkColorLower === 'magenta') {
      inkBgColor = '#e6007e';
    } else if (inkColorLower === 'cyan') {
      inkBgColor = '#00aeef';
    } else if (inkColorLower === 'yellow') {
      inkBgColor = '#d97706'; // Rich amber-yellow tone
      textShadowStyle = 'text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);'; // Text outline shadow for visibility
    }

    const colorBadge = isInk && item.color 
      ? `<span class="badge badge-info" style="background-color: ${inkBgColor}; color: #ffffff; font-weight: bold; margin-left: 5px; ${textShadowStyle}">${escapeHTML(item.color)}</span>` 
      : '';

    const peripheralBadge = isPeripheral && item.peripheralType
      ? `<span class="badge badge-info" style="background-color: #3a86ff; color: #ffffff; font-weight: bold; margin-left: 5px;">${escapeHTML(item.peripheralType)}</span>`
      : '';

    const brandModelText = isPeripheral
      ? (item.peripheralType ? escapeHTML(item.peripheralType) : 'Peripheral')
      : (`${escapeHTML(item.brand)} ${escapeHTML(item.model)}`.trim() || 'N/A');

    // Dynamic Columns
    let detailColumns = '';
    if (isInk) {
      detailColumns = `
        <div class="meta-item">
          <label>BOTTLE QUANTITY</label>
          <span>${item.quantity} Bottle(s)</span>
        </div>
        <div class="meta-item"><label>STATUS</label><span class="badge ${badgeClass}">${escapeHTML(item.status)}</span></div>
      `;
    } else if (isPeripheral) {
      detailColumns = `
        <div class="meta-item"><label>QUANTITY</label><span>${item.quantity} Unit(s)</span></div>
        <div class="meta-item"><label>STATUS</label><span class="badge ${badgeClass}">${escapeHTML(item.status)}</span></div>
      `;
    } else if (hasQuantity) {
      detailColumns = `
        <div class="meta-item"><label>QUANTITY</label><span>${item.quantity} Unit(s)</span></div>
        <div class="meta-item"><label>SPECIFICATIONS</label><span>${escapeHTML(item.specs || 'N/A')}</span></div>
        <div class="meta-item"><label>SERIAL NUMBER</label><span>${escapeHTML(item.serial || 'N/A')}</span></div>
        <div class="meta-item"><label>STATUS</label><span class="badge ${badgeClass}">${escapeHTML(item.status)}</span></div>
      `;
    } else {
      detailColumns = `
        <div class="meta-item"><label>SPECIFICATIONS</label><span>${escapeHTML(item.specs || 'N/A')}</span></div>
        <div class="meta-item"><label>SERIAL NUMBER</label><span>${escapeHTML(item.serial || 'N/A')}</span></div>
        <div class="meta-item"><label>STATUS</label><span class="badge ${badgeClass}">${escapeHTML(item.status)}</span></div>
      `;
    }

    // Only render the "- 0.5" button if the item is Ink
    const deductButton = isInk ? `
      <button class="btn btn-danger btn-sm" style="background-color: #ef476f; border: none; color: white; font-weight: bold;" onclick="openRefillModal('${item.id}', ${item.quantity})" title="Deduct 0.5 bottle">- 0.5</button>
    ` : '';

    card.innerHTML = `
      <div class="device-meta" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <div class="meta-item"><label>TYPE</label><span>${escapeHTML(item.type)} ${colorBadge}${peripheralBadge}</span></div>
        <div class="meta-item"><label>${isPeripheral ? 'PERIPHERAL' : 'BRAND & MODEL'}</label><span>${brandModelText}</span></div>
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

  // If viewing a specific ink color subcategory, append the Refill History Section with Toggle & Delete All Buttons
  if (currentColorFilter) {
    const historyWrapper = document.createElement('div');
    historyWrapper.innerHTML = renderRefillHistorySection();
    container.appendChild(historyWrapper);
  }
}

// Toggle visibility of the refill history section
function toggleRefillHistoryVisibility() {
  isRefillHistoryVisible = !isRefillHistoryVisible;
  renderSpareCards();
}

// Open Custom Refill Modal
function openRefillModal(id, currentQty) {
  document.getElementById('refill-spare-id').value = id;
  document.getElementById('refill-workstation').value = '';
  openModal('refill-modal');
}

// Handle Refill Form Submission & History Logging
async function handleRefillSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('refill-spare-id').value;
  const workstation = document.getElementById('refill-workstation').value.trim();
  const targetItem = sparePartsList.find(i => i.id === id);
  if (!targetItem) return;

  const rawQty = Math.max(0, targetItem.quantity - 0.5);
  const newQty = parseFloat(rawQty.toFixed(2));

  const newLog = {
    workstation: workstation,
    amount: 0.5,
    date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  const existingHistory = targetItem.refillHistory || [];

  const payload = {
    ...targetItem,
    item_type: targetItem.type,
    serial_number: targetItem.serial || '',
    quantity: newQty,
    status: newQty === 0 ? 'Defective' : targetItem.status,
    refillHistory: [newLog, ...existingHistory]
  };

  try {
    const res = await fetch(`${SPARES_API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      closeModal('refill-modal');
      await loadSpareParts();
    } else {
      const errData = await res.json().catch(() => ({}));
      alert(`Failed to update ink level: ${errData.error || res.statusText || 'Server error'}`);
    }
  } catch (err) {
    console.error('Consume Ink Error:', err);
    alert('Network error while updating ink level.');
  }
}

// Delete a specific refill log entry
async function deleteRefillLog(spareId, logId) {
  if (!confirm('Are you sure you want to delete this refill history log?')) return;

  const targetItem = sparePartsList.find(i => i.id === spareId);
  if (!targetItem) return;

  const updatedHistory = (targetItem.refillHistory || []).filter(log => log._id !== logId);

  const payload = {
    ...targetItem,
    item_type: targetItem.type,
    serial_number: targetItem.serial || '',
    refillHistory: updatedHistory
  };

  try {
    const res = await fetch(`${SPARES_API_URL}/${spareId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      await loadSpareParts();
    } else {
      const errData = await res.json().catch(() => ({}));
      alert(`Failed to delete history log: ${errData.error || 'Server error'}`);
    }
  } catch (err) {
    console.error('Delete Refill Log Error:', err);
    alert('Network error while deleting history log.');
  }
}

// Delete All Refill Logs for the Active Ink Color
async function deleteAllRefillLogs() {
  if (!confirm(`Are you sure you want to delete all refill history logs for ${currentColorFilter} ink?`)) return;

  const filteredInkItems = sparePartsList.filter(i => 
    (i.type || '').toLowerCase() === 'ink' && 
    (i.color || '').toLowerCase() === currentColorFilter.toLowerCase()
  );

  try {
    for (const item of filteredInkItems) {
      const payload = {
        ...item,
        item_type: item.type,
        serial_number: item.serial || '',
        refillHistory: []
      };

      await fetch(`${SPARES_API_URL}/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    await loadSpareParts();
  } catch (err) {
    console.error('Delete All Refill Logs Error:', err);
    alert('Failed to clear refill history logs.');
  }
}

// Render Refill History Table for Active Ink Color with Toggle Support, Delete All, and Delete Buttons
function renderRefillHistorySection() {
  const buttonText = isRefillHistoryVisible ? '👁️‍🗨️ Hide History' : '👁️ See History';
  const deleteAllButton = `<button class="btn btn-danger btn-sm" style="padding: 0.25rem 0.6rem; font-size: 0.8rem; background-color: #ef476f; border: none; color: white;" onclick="deleteAllRefillLogs()">🗑️ Delete All</button>`;
  const toggleButton = `<button class="btn btn-secondary btn-sm" onclick="toggleRefillHistoryVisibility()">${buttonText}</button>`;

  if (!isRefillHistoryVisible) {
    return `
      <div class="device-card" style="margin-top: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="font-size: 1rem; margin: 0; color: var(--text);">📋 Refill History — ${currentColorFilter} Ink</h3>
        <div style="display: flex; gap: 8px; align-items: center;">
          ${deleteAllButton}
          ${toggleButton}
        </div>
      </div>
    `;
  }

  const filteredInkItems = sparePartsList.filter(i => 
    (i.type || '').toLowerCase() === 'ink' && 
    (i.color || '').toLowerCase() === currentColorFilter.toLowerCase()
  );

  let allLogs = [];
  filteredInkItems.forEach(item => {
    if (item.refillHistory && Array.isArray(item.refillHistory)) {
      item.refillHistory.forEach(log => {
        allLogs.push({ 
          ...log, 
          spareId: item.id, 
          brandModel: `${item.brand} ${item.model}` 
        });
      });
    }
  });

  if (allLogs.length === 0) {
    return `
      <div class="device-card" style="margin-top: 1.5rem; background: var(--card);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="font-size: 1rem; margin: 0; color: var(--text);">📋 Refill History — ${currentColorFilter} Ink</h3>
          <div style="display: flex; gap: 8px; align-items: center;">
            ${deleteAllButton}
            ${toggleButton}
          </div>
        </div>
        <p style="color: var(--text-muted, #6c757d); text-align: center; margin: 0;">No refill history recorded for ${currentColorFilter} ink yet.</p>
      </div>
    `;
  }

  let rows = allLogs.map(log => `
    <tr>
      <td style="padding: 0.75rem; border-bottom: 1px solid var(--border);">${escapeHTML(log.date)}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid var(--border); font-weight: 600;">${escapeHTML(log.workstation)}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid var(--border);">${escapeHTML(log.brandModel)}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid var(--border); color: var(--danger, #ef476f); font-weight: bold;">-${log.amount} Bottle</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid var(--border); text-align: right;">
        <button class="btn btn-danger btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onclick="deleteRefillLog('${log.spareId}', '${log._id}')">🗑️ Delete</button>
      </td>
    </tr>
  `).join('');

  return `
    <div class="device-card" style="margin-top: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="font-size: 1rem; margin: 0; color: var(--text);">📋 Refill History — ${currentColorFilter} Ink</h3>
        <div style="display: flex; gap: 8px; align-items: center;">
          ${deleteAllButton}
          ${toggleButton}
        </div>
      </div>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.88rem;">
          <thead>
            <tr style="background: var(--table-header-bg, #f8fafc); color: var(--text-muted, #6c757d);">
              <th style="padding: 0.75rem; border-bottom: 2px solid var(--border);">Date & Time</th>
              <th style="padding: 0.75rem; border-bottom: 2px solid var(--border);">Workstation / Printer Refilled</th>
              <th style="padding: 0.75rem; border-bottom: 2px solid var(--border);">Ink Brand & Model</th>
              <th style="padding: 0.75rem; border-bottom: 2px solid var(--border);">Deduction</th>
              <th style="padding: 0.75rem; border-bottom: 2px solid var(--border); text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
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
      (item.color || '').toLowerCase().includes(searchTerm) ||
      (item.peripheralType || '').toLowerCase().includes(searchTerm);

    return matchesCategory && matchesColor && matchesSearch;
  });
}

// Main Category Filtering
function filterSpareCategory(category, element) {
  currentCategory = category;
  currentColorFilter = null;
  isRefillHistoryVisible = false; // Reset toggle on category change
  
  document.querySelectorAll('#spare-category-sidebar li').forEach(li => li.classList.remove('active'));
  if (element) element.classList.add('active');

  renderSpareCards();
  updateAnalytics();
}

// Subcategory Ink Color Filtering
function filterInkColor(color, element) {
  currentCategory = 'Ink';
  currentColorFilter = color;
  isRefillHistoryVisible = false; // Reset toggle when switching ink colors

  document.querySelectorAll('#spare-category-sidebar li').forEach(li => li.classList.remove('active'));
  if (element) element.classList.add('active');

  renderSpareCards();
  updateAnalytics();
}

// Dynamic Analytics Summary Cards: Displays Ink Color & Bottle Totals when in Ink section
function updateAnalytics() {
  const dashboard = document.getElementById('analytics-dashboard');
  const isInkMode = currentCategory.toUpperCase() === 'INK' || currentColorFilter !== null;

  if (isInkMode && dashboard) {
    const inkItems = sparePartsList.filter(i => (i.type || '').toLowerCase() === 'ink');

    const sumColor = (col) => inkItems
      .filter(i => (i.color || '').toLowerCase() === col.toLowerCase())
      .reduce((acc, curr) => acc + (parseFloat(curr.quantity) || 0), 0);

    const blackTotal = sumColor('Black');
    const magentaTotal = sumColor('Magenta');
    const cyanTotal = sumColor('Cyan');
    const yellowTotal = sumColor('Yellow');

    dashboard.innerHTML = `
      <div class="stat-card card-blue">
        <div class="stat-title">⚫ Black Ink</div>
        <div class="stat-value">${blackTotal} <span style="font-size: 1rem; font-weight: normal;">Bottle(s)</span></div>
      </div>
      <div class="stat-card card-amber">
        <div class="stat-title">🔴 Magenta Ink</div>
        <div class="stat-value">${magentaTotal} <span style="font-size: 1rem; font-weight: normal;">Bottle(s)</span></div>
      </div>
      <div class="stat-card card-green">
        <div class="stat-title">🔵 Cyan Ink</div>
        <div class="stat-value">${cyanTotal} <span style="font-size: 1rem; font-weight: normal;">Bottle(s)</span></div>
      </div>
      <div class="stat-card card-purple">
        <div class="stat-title">🟡 Yellow Ink</div>
        <div class="stat-value">${yellowTotal} <span style="font-size: 1rem; font-weight: normal;">Bottle(s)</span></div>
      </div>
    `;
  } else if (dashboard) {
    const total = sparePartsList.length;
    const available = sparePartsList.filter(i => i.status === 'Available').length;
    const inUse = sparePartsList.filter(i => i.status === 'In Use').length;
    const defective = sparePartsList.filter(i => i.status === 'Defective').length;

    dashboard.innerHTML = `
      <div class="stat-card card-blue">
        <div class="stat-title">Total Spares</div>
        <div class="stat-value" id="stat-total-spares">${total}</div>
      </div>
      <div class="stat-card card-green">
        <div class="stat-title">Available</div>
        <div class="stat-value" id="stat-available-spares">${available}</div>
      </div>
      <div class="stat-card card-amber">
        <div class="stat-title">In Use</div>
        <div class="stat-value" id="stat-inuse-spares">${inUse}</div>
      </div>
      <div class="stat-card card-purple">
        <div class="stat-title">Defective</div>
        <div class="stat-value" id="stat-defective-spares">${defective}</div>
      </div>
    `;
  } else {
    // Fallback if individual elements exist without a parent container element
    const total = sparePartsList.length;
    const available = sparePartsList.filter(i => i.status === 'Available').length;
    const inUse = sparePartsList.filter(i => i.status === 'In Use').length;
    const defective = sparePartsList.filter(i => i.status === 'Defective').length;

    if (document.getElementById('stat-total-spares')) document.getElementById('stat-total-spares').textContent = total;
    if (document.getElementById('stat-available-spares')) document.getElementById('stat-available-spares').textContent = available;
    if (document.getElementById('stat-inuse-spares')) document.getElementById('stat-inuse-spares').textContent = inUse;
    if (document.getElementById('stat-defective-spares')) document.getElementById('stat-defective-spares').textContent = defective;
  }
}

// Toggle Fields: Shows tailored inputs for Ink, Peripherals, RAM, Storage, and other types
function toggleFormFieldsForType() {
  const typeSelect = document.getElementById('spare-type');
  const colorGroup = document.getElementById('ink-color-group');
  const peripheralGroup = document.getElementById('peripheral-type-group');
  const brandGroup = document.getElementById('brand-group');
  const modelGroup = document.getElementById('model-group');
  const brandInput = document.getElementById('spare-brand');
  const modelInput = document.getElementById('spare-model');
  const quantityGroup = document.getElementById('spare-quantity-group');
  const quantityLabel = document.getElementById('quantity-label');
  const quantityInput = document.getElementById('spare-quantity');
  const standardFields = document.getElementById('standard-fields-group');

  const selectedType = (typeSelect?.value || '').toLowerCase();

  // Reset defaults
  if (colorGroup) colorGroup.style.display = 'none';
  if (peripheralGroup) peripheralGroup.style.display = 'none';
  if (brandGroup) brandGroup.style.display = 'block';
  if (modelGroup) modelGroup.style.display = 'block';
  if (brandInput) brandInput.required = true;
  if (modelInput) modelInput.required = true;
  if (standardFields) standardFields.style.display = 'block';
  if (quantityGroup) quantityGroup.style.display = 'none';

  if (selectedType === 'ink') {
    if (colorGroup) colorGroup.style.display = 'block';
    if (quantityGroup) quantityGroup.style.display = 'block';
    if (quantityLabel) quantityLabel.textContent = 'Number of Bottles';
    if (quantityInput) {
      quantityInput.step = '0.5';
      quantityInput.min = '0';
    }
    if (standardFields) standardFields.style.display = 'none';
  } else if (selectedType === 'peripherals') {
    refreshPeripheralSelectOptions(document.getElementById('peripheral-select')?.value || '');
    if (brandGroup) brandGroup.style.display = 'none';
    if (modelGroup) modelGroup.style.display = 'none';
    if (brandInput) {
      brandInput.required = false;
      brandInput.value = '';
    }
    if (modelInput) {
      modelInput.required = false;
      modelInput.value = '';
    }
    if (peripheralGroup) peripheralGroup.style.display = 'block';
    if (standardFields) standardFields.style.display = 'none';
    if (quantityGroup) quantityGroup.style.display = 'block';
    if (quantityLabel) quantityLabel.textContent = 'Quantity';
    if (quantityInput) {
      quantityInput.step = '1';
      quantityInput.min = '1';
      if (parseFloat(quantityInput.value) < 1 || isNaN(parseFloat(quantityInput.value))) {
        quantityInput.value = '1';
      }
    }
  } else if (selectedType === 'ram' || selectedType === 'storage') {
    if (document.getElementById('spare-color')) document.getElementById('spare-color').value = '';
    if (quantityGroup) quantityGroup.style.display = 'block';
    if (quantityLabel) quantityLabel.textContent = 'Quantity';
    if (quantityInput) {
      quantityInput.step = '1';
      quantityInput.min = '1';
    }
  } else {
    if (document.getElementById('spare-color')) document.getElementById('spare-color').value = '';
    if (quantityInput) quantityInput.value = '1';
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

  const refillForm = document.getElementById('refill-ink-form');
  if (refillForm) {
    refillForm.addEventListener('submit', handleRefillSubmit);
  }
}

// Open Add Modal
function openAddSpareModal() {
  document.getElementById('spare-modal-title').textContent = 'Add Spare Part';
  document.getElementById('spare-id').value = '';
  document.getElementById('add-spare-form').reset();
  refreshPeripheralSelectOptions('');
  toggleCustomPeripheralInput(false);
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

  toggleCustomPeripheralInput(false);
  toggleFormFieldsForType();

  const itemTypeLower = (item.type || '').toLowerCase();
  if (itemTypeLower === 'ink') {
    if (document.getElementById('spare-color')) document.getElementById('spare-color').value = item.color || '';
    if (document.getElementById('spare-quantity')) document.getElementById('spare-quantity').value = item.quantity !== undefined ? item.quantity : 1;
  } else if (itemTypeLower === 'peripherals') {
    const pVal = item.peripheralType || '';
    refreshPeripheralSelectOptions(pVal);
    if (document.getElementById('spare-quantity')) document.getElementById('spare-quantity').value = item.quantity !== undefined ? item.quantity : 1;
  } else if (['ram', 'storage'].includes(itemTypeLower)) {
    if (document.getElementById('spare-quantity')) document.getElementById('spare-quantity').value = item.quantity !== undefined ? item.quantity : 1;
    if (document.getElementById('spare-specs')) document.getElementById('spare-specs').value = item.specs || '';
    if (document.getElementById('spare-serial')) document.getElementById('spare-serial').value = item.serial || '';
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
  const typeVal = document.getElementById('spare-type').value;
  const typeValLower = typeVal.toLowerCase();
  const isInk = typeValLower === 'ink';
  const isPeripheral = typeValLower === 'peripherals';
  const isHardwareWithQty = ['ram', 'storage'].includes(typeValLower);

  let peripheralTypeVal = '';
  if (isPeripheral) {
    const customInput = document.getElementById('peripheral-custom-input');
    const customVal = customInput?.value.trim() || '';
    if (isCustomPeripheralMode && customVal) {
      if (!addCustomPeripheralToSelect()) return;
    }
    peripheralTypeVal = document.getElementById('peripheral-select')?.value || customVal || '';
    if (!peripheralTypeVal) {
      return alert('Please select or enter a Peripheral Type.');
    }
  }

  const payload = {
    item_type: typeVal,
    brand: isPeripheral ? '' : document.getElementById('spare-brand').value,
    model: isPeripheral ? '' : document.getElementById('spare-model').value,
    status: document.getElementById('spare-status').value,
    color: isInk ? document.getElementById('spare-color').value : '',
    peripheral_type: peripheralTypeVal,
    quantity: (isInk || isPeripheral || isHardwareWithQty) ? parseFloat(document.getElementById('spare-quantity').value) || 1 : 1,
    specs: (isInk || isPeripheral) ? '' : document.getElementById('spare-specs').value,
    serial_number: (isInk || isPeripheral) ? '' : document.getElementById('spare-serial').value
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