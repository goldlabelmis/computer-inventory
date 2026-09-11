// Global Application State
let inventoryData = [];
let sparePartsData = [];
let techniciansData = [];
let currentUser = null;
let currentFilterPC = 'ALL';

// DOM Elements Initialization
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupEventListeners();
});

// Initialize Application Data & State
async function initApp() {
  await checkAuthStatus();
  await refreshDashboardStats();
  await loadTechnicians();
  await loadInventory();
}

// Setup Event Listeners for Forms and Inputs
function setupEventListeners() {
  // Sidebar Toggle
  const sidebarToggle = document.getElementById('sidebar-toggle-btn');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      document.getElementById('app-sidebar').classList.toggle('collapsed');
    });
  }

  // Live Search
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
  }

  // Form Submissions
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('add-workstation-form').addEventListener('submit', handleSaveWorkstation);
  document.getElementById('add-part-form').addEventListener('submit', handleSavePart);
  document.getElementById('add-repair-form').addEventListener('submit', handleSaveRepair);
  document.getElementById('add-tech-form').addEventListener('submit', handleAddTechnician);
  document.getElementById('add-spare-form').addEventListener('submit', handleSaveSparePart);
}

/* --- AUTHENTICATION HANDLERS --- */
async function checkAuthStatus() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    currentUser = data.user;
    updateUIState();
  } catch (err) {
    console.error('Error checking auth state:', err);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      currentUser = data.user;
      closeModal('login-modal');
      document.getElementById('login-form').reset();
      updateUIState();
      await initApp();
    } else {
      alert(data.error || 'Login failed');
    }
  } catch (err) {
    console.error('Login Error:', err);
  }
}

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    updateUIState();
    await initApp();
  } catch (err) {
    console.error('Logout Error:', err);
  }
}

function updateUIState() {
  const body = document.body;
  const authBtn = document.getElementById('auth-btn');
  const userInfo = document.getElementById('user-info');

  if (currentUser && currentUser.role === 'administrator') {
    body.classList.add('is-admin');
    authBtn.innerHTML = '🔓 Logout';
    authBtn.onclick = handleLogout;
    userInfo.innerHTML = `<span>Administrator Mode (${currentUser.username})</span>`;
  } else {
    body.classList.remove('is-admin');
    authBtn.innerHTML = '🔒 Login';
    authBtn.onclick = () => openModal('login-modal');
    userInfo.innerHTML = '<span>View Only Mode</span>';
  }
}

/* --- DASHBOARD & ANALYTICS --- */
async function refreshDashboardStats() {
  try {
    const res = await fetch('/api/dashboard/stats');
    const data = await res.json();

    document.getElementById('stat-pcs').textContent = data.totalComputers || 0;
    document.getElementById('stat-parts').textContent = data.totalParts || 0;
    document.getElementById('stat-repairs').textContent = data.totalRepairs || 0;
    document.getElementById('stat-spares').textContent = data.totalSpares || 0;
    document.getElementById('stat-techs').textContent = data.totalTechs || 0;
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
  }
}

/* --- INVENTORY & SIDEBAR RENDERING --- */
async function loadInventory() {
  try {
    const res = await fetch('/api/inventory');
    inventoryData = await res.json();
    renderSidebar();
    renderInventory();
  } catch (err) {
    console.error('Failed to load inventory:', err);
  }
}

function renderSidebar() {
  const sidebarList = document.getElementById('pc-list-sidebar');
  sidebarList.innerHTML = `
    <li class="${currentFilterPC === 'ALL' ? 'active' : ''}" onclick="filterByPC('ALL')">
      <span class="icon">💻</span>
      <span class="label">All PCs</span>
    </li>
  `;

  inventoryData.forEach(comp => {
    const li = document.createElement('li');
    if (currentFilterPC === comp._id) li.classList.add('active');
    li.onclick = () => filterByPC(comp._id);
    li.innerHTML = `
      <span class="icon">🖥️</span>
      <span class="label">${escapeHTML(comp.property_name)}</span>
    `;
    sidebarList.appendChild(li);
  });
}

function filterByPC(pcId) {
  currentFilterPC = pcId;
  renderSidebar();
  renderInventory();
}

function renderInventory(dataToRender = null) {
  const container = document.getElementById('inventory-list');
  container.innerHTML = '';

  const list = dataToRender || (currentFilterPC === 'ALL' 
    ? inventoryData 
    : inventoryData.filter(c => c._id === currentFilterPC));

  if (list.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No workstations found.</p>';
    return;
  }

  list.forEach(comp => {
    const card = document.createElement('div');
    card.className = 'device-card';

    // Workstation Metadata Header
    card.innerHTML = `
      <div class="device-meta">
        <div class="meta-item"><label>Property Name</label><span>${escapeHTML(comp.property_name)}</span></div>
        <div class="meta-item"><label>Property Code</label><span>${escapeHTML(comp.property_code)}</span></div>
        <div class="meta-item"><label>Location</label><span>${escapeHTML(comp.location || 'N/A')}</span></div>
        <div class="meta-item"><label>Department</label><span>${escapeHTML(comp.department || 'N/A')}</span></div>
        <div class="meta-item"><label>DRP 1</label><span>${escapeHTML(comp.drp1 || 'N/A')}</span></div>
        <div class="meta-item"><label>DRP 2</label><span>${escapeHTML(comp.drp2 || 'N/A')}</span></div>
      </div>
      
      <div class="card-actions admin-only" style="margin-bottom: 1rem;">
        <button class="btn btn-secondary btn-sm" onclick="editWorkstation('${comp._id}')">✏️ Edit Workstation</button>
        <button class="btn btn-danger btn-sm" onclick="deleteWorkstation('${comp._id}')">🗑️ Delete</button>
      </div>

      <!-- Installed Parts Section -->
      <div class="sub-header">
        <h4>Installed Components / Peripherals</h4>
        <button class="btn btn-primary btn-sm admin-only" onclick="openAddPartModal('${comp._id}')">+ Add Part</button>
      </div>
      ${renderPartsTable(comp._id, comp.parts || [])}

      <!-- Repair Logs Section -->
      <div class="sub-header" style="margin-top: 1.5rem;">
        <h4>Repair & Maintenance History</h4>
        <button class="btn btn-primary btn-sm admin-only" onclick="openAddRepairModal('${comp._id}')">+ Log Repair</button>
      </div>
      ${renderRepairTable(comp._id, comp.history || [])}
    `;

    container.appendChild(card);
  });
}

function renderPartsTable(compId, parts) {
  if (parts.length === 0) return '<p style="font-size: 0.8rem; color: var(--text-muted);">No components installed.</p>';
  return `
    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Brand</th>
          <th>Model</th>
          <th>Specs</th>
          <th>Serial No.</th>
          <th>Date Purchased</th>
          <th class="admin-only">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${parts.map(p => `
          <tr>
            <td><strong>${escapeHTML(p.item_type || '')}</strong></td>
            <td>${escapeHTML(p.brand || '')}</td>
            <td>${escapeHTML(p.model || '')}</td>
            <td>${escapeHTML(p.specs || '')}</td>
            <td>${escapeHTML(p.serial_number || '')}</td>
            <td>${escapeHTML(p.date_purchased || '')}</td>
            <td class="admin-only">
              <button class="btn btn-outline btn-sm" onclick="editPart('${compId}', '${p._id}')">✏️</button>
              <button class="btn btn-danger btn-sm" onclick="deletePart('${p._id}')">🗑️</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderRepairTable(compId, history) {
  if (history.length === 0) return '<p style="font-size: 0.8rem; color: var(--text-muted);">No maintenance logs recorded.</p>';
  return `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Item</th>
          <th>Description</th>
          <th>Technician</th>
          <th class="admin-only">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${history.map(r => `
          <tr>
            <td>${escapeHTML(r.log_date || '')}</td>
            <td>${escapeHTML(r.item || '')}</td>
            <td>${escapeHTML(r.description || '')}</td>
            <td><span class="badge-qty">${escapeHTML(r.remarks || 'Unassigned')}</span></td>
            <td class="admin-only">
              <button class="btn btn-outline btn-sm" onclick="editRepair('${compId}', '${r._id}')">✏️</button>
              <button class="btn btn-danger btn-sm" onclick="deleteRepair('${r._id}')">🗑️</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/* --- WORKSTATION ACTIONS --- */
async function handleSaveWorkstation(e) {
  e.preventDefault();
  const id = document.getElementById('edit-comp-id').value;
  const payload = {
    property_name: document.getElementById('prop-name').value,
    property_code: document.getElementById('prop-code').value,
    location: document.getElementById('prop-loc').value,
    department: document.getElementById('prop-dept').value,
    drp1: document.getElementById('prop-drp1').value,
    drp2: document.getElementById('prop-drp2').value
  };

  const url = id ? `/api/computers/${id}` : '/api/computers';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      closeModal('workstation-modal');
      document.getElementById('add-workstation-form').reset();
      await loadInventory();
      await refreshDashboardStats();
    }
  } catch (err) {
    console.error('Failed to save workstation:', err);
  }
}

function editWorkstation(id) {
  const comp = inventoryData.find(c => c._id === id);
  if (!comp) return;

  document.getElementById('workstation-modal-title').textContent = 'Edit Workstation';
  document.getElementById('edit-comp-id').value = comp._id;
  document.getElementById('prop-name').value = comp.property_name || '';
  document.getElementById('prop-code').value = comp.property_code || '';
  document.getElementById('prop-loc').value = comp.location || '';
  document.getElementById('prop-dept').value = comp.department || '';
  document.getElementById('prop-drp1').value = comp.drp1 || '';
  document.getElementById('prop-drp2').value = comp.drp2 || '';

  openModal('workstation-modal');
}

async function deleteWorkstation(id) {
  if (!confirm('Are you sure you want to delete this workstation and all associated components?')) return;
  try {
    const res = await fetch(`/api/computers/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await loadInventory();
      await refreshDashboardStats();
    }
  } catch (err) {
    console.error('Delete workstation error:', err);
  }
}

/* --- COMPONENT / PART ACTIONS --- */
function openAddPartModal(compId) {
  document.getElementById('part-modal-title').textContent = 'Add Component';
  document.getElementById('add-part-form').reset();
  document.getElementById('part-id').value = '';
  document.getElementById('part-comp-id').value = compId;
  openModal('part-modal');
}

function editPart(compId, partId) {
  const comp = inventoryData.find(c => c._id === compId);
  const part = comp?.parts.find(p => p._id === partId);
  if (!part) return;

  document.getElementById('part-modal-title').textContent = 'Edit Component';
  document.getElementById('part-id').value = part._id;
  document.getElementById('part-comp-id').value = compId;
  document.getElementById('part-type').value = part.item_type || '';
  document.getElementById('part-brand').value = part.brand || '';
  document.getElementById('part-model').value = part.model || '';
  document.getElementById('part-date').value = part.date_purchased || '';
  document.getElementById('part-sn').value = part.serial_number || '';
  document.getElementById('part-specs').value = part.specs || '';

  openModal('part-modal');
}

async function handleSavePart(e) {
  e.preventDefault();
  const partId = document.getElementById('part-id').value;
  const compId = document.getElementById('part-comp-id').value;

  const payload = {
    computer_id: compId,
    item_type: document.getElementById('part-type').value,
    brand: document.getElementById('part-brand').value,
    model: document.getElementById('part-model').value,
    date_purchased: document.getElementById('part-date').value,
    serial_number: document.getElementById('part-sn').value,
    specs: document.getElementById('part-specs').value
  };

  const url = partId ? `/api/components/${partId}` : '/api/components';
  const method = partId ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      closeModal('part-modal');
      await loadInventory();
      await refreshDashboardStats();
    }
  } catch (err) {
    console.error('Failed to save component:', err);
  }
}

async function deletePart(partId) {
  if (!confirm('Are you sure you want to remove this part?')) return;
  try {
    const res = await fetch(`/api/components/${partId}`, { method: 'DELETE' });
    if (res.ok) {
      await loadInventory();
      await refreshDashboardStats();
    }
  } catch (err) {
    console.error('Failed to delete part:', err);
  }
}

/* --- REPAIR LOG ACTIONS --- */
function openAddRepairModal(compId) {
  document.getElementById('repair-modal-title').textContent = 'Log Repair';
  document.getElementById('add-repair-form').reset();
  document.getElementById('repair-id').value = '';
  document.getElementById('repair-comp-id').value = compId;
  openModal('repair-modal');
}

function editRepair(compId, repairId) {
  const comp = inventoryData.find(c => c._id === compId);
  const log = comp?.history.find(r => r._id === repairId);
  if (!log) return;

  document.getElementById('repair-modal-title').textContent = 'Edit Repair Log';
  document.getElementById('repair-id').value = log._id;
  document.getElementById('repair-comp-id').value = compId;
  document.getElementById('repair-date').value = log.log_date || '';
  document.getElementById('repair-item').value = log.item || '';
  document.getElementById('repair-desc').value = log.description || '';
  document.getElementById('repair-remarks').value = log.remarks || '';

  openModal('repair-modal');
}

async function handleSaveRepair(e) {
  e.preventDefault();
  const repairId = document.getElementById('repair-id').value;
  const compId = document.getElementById('repair-comp-id').value;

  const payload = {
    computer_id: compId,
    log_date: document.getElementById('repair-date').value,
    item: document.getElementById('repair-item').value,
    description: document.getElementById('repair-desc').value,
    remarks: document.getElementById('repair-remarks').value
  };

  const url = repairId ? `/api/repair-logs/${repairId}` : '/api/repair-logs';
  const method = repairId ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      closeModal('repair-modal');
      await loadInventory();
      await refreshDashboardStats();
    }
  } catch (err) {
    console.error('Failed to save repair log:', err);
  }
}

async function deleteRepair(repairId) {
  if (!confirm('Are you sure you want to remove this repair log?')) return;
  try {
    const res = await fetch(`/api/repair-logs/${repairId}`, { method: 'DELETE' });
    if (res.ok) {
      await loadInventory();
      await refreshDashboardStats();
    }
  } catch (err) {
    console.error('Failed to delete repair log:', err);
  }
}

/* --- SPARE PARTS INVENTORY --- */
async function openSparePartsModal() {
  resetSpareForm();
  await loadSpareParts();
  openModal('spare-modal');
}

async function loadSpareParts() {
  try {
    const res = await fetch('/api/spare-parts');
    sparePartsData = await res.json();
    renderSparePartsList();
  } catch (err) {
    console.error('Failed to fetch spare parts:', err);
  }
}

function renderSparePartsList() {
  const container = document.getElementById('spare-parts-list');
  container.innerHTML = '';

  if (sparePartsData.length === 0) {
    container.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1rem;">No spare parts available.</td></tr>';
    return;
  }

  sparePartsData.forEach(spare => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding: 0.5rem;"><strong>${escapeHTML(spare.item_type || '')}</strong></td>
      <td style="padding: 0.5rem;">${escapeHTML((spare.brand || '') + ' ' + (spare.model || '')).trim()}</td>
      <td style="padding: 0.5rem;">${escapeHTML(spare.specs || '')}</td>
      <td style="padding: 0.5rem;">${escapeHTML(spare.serial_number || 'N/A')}</td>
      <td style="padding: 0.5rem;">${renderStatusBadge(spare.status)}</td>
      <td class="admin-only" style="padding: 0.5rem; text-align: right;">
        <button class="btn btn-outline btn-sm" onclick="editSparePart('${spare._id}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteSparePart('${spare._id}')">🗑️</button>
      </td>
    `;
    container.appendChild(tr);
  });
}

function renderStatusBadge(status = 'Available') {
  let colorStyle = 'background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;';
  if (status === 'In Use') {
    colorStyle = 'background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;';
  } else if (status === 'Defective') {
    colorStyle = 'background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5;';
  }
  return `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; ${colorStyle}">${escapeHTML(status)}</span>`;
}

async function handleSaveSparePart(e) {
  e.preventDefault();
  const id = document.getElementById('spare-id').value;
  const payload = {
    item_type: document.getElementById('spare-type').value,
    brand: document.getElementById('spare-brand').value,
    model: document.getElementById('spare-model').value,
    specs: document.getElementById('spare-specs').value,
    serial_number: document.getElementById('spare-sn').value,
    status: document.getElementById('spare-status').value
  };

  const url = id ? `/api/spare-parts/${id}` : '/api/spare-parts';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      resetSpareForm();
      await loadSpareParts();
      await refreshDashboardStats();
    }
  } catch (err) {
    console.error('Failed to save spare part:', err);
  }
}

function editSparePart(id) {
  const item = sparePartsData.find(s => s._id === id);
  if (!item) return;

  document.getElementById('spare-id').value = item._id;
  document.getElementById('spare-type').value = item.item_type || '';
  document.getElementById('spare-brand').value = item.brand || '';
  document.getElementById('spare-model').value = item.model || '';
  document.getElementById('spare-specs').value = item.specs || '';
  document.getElementById('spare-sn').value = item.serial_number || '';
  document.getElementById('spare-status').value = item.status || 'Available';

  document.getElementById('spare-submit-btn').textContent = 'Update Spare Part';
  document.getElementById('cancel-spare-edit-btn').style.display = 'inline-block';
}

function resetSpareForm() {
  document.getElementById('add-spare-form').reset();
  document.getElementById('spare-id').value = '';
  document.getElementById('spare-submit-btn').textContent = '+ Add Spare Part';
  document.getElementById('cancel-spare-edit-btn').style.display = 'none';
}

async function deleteSparePart(id) {
  if (!confirm('Are you sure you want to delete this spare part?')) return;
  try {
    const res = await fetch(`/api/spare-parts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await loadSpareParts();
      await refreshDashboardStats();
    }
  } catch (err) {
    console.error('Failed to delete spare part:', err);
  }
}

/* --- TECHNICIAN MANAGEMENT --- */
async function openTechModal() {
  await loadTechnicians();
  openModal('tech-modal');
}

async function loadTechnicians() {
  try {
    const res = await fetch('/api/technicians');
    techniciansData = await res.json();
    renderTechnicianList();
    populateTechnicianDropdown();
  } catch (err) {
    console.error('Failed to fetch technicians:', err);
  }
}

function renderTechnicianList() {
  const container = document.getElementById('tech-manage-list');
  container.innerHTML = '';

  if (techniciansData.length === 0) {
    container.innerHTML = '<li style="color: var(--text-muted); padding: 0.5rem; text-align: center;">No technicians configured.</li>';
    return;
  }

  techniciansData.forEach(tech => {
    const li = document.createElement('li');
    li.className = 'tech-item';
    li.innerHTML = `
      <span>👤 ${escapeHTML(tech.name)}</span>
      <button class="btn btn-danger btn-sm admin-only" onclick="deleteTechnician('${tech._id}')">Remove</button>
    `;
    container.appendChild(li);
  });
}

function populateTechnicianDropdown() {
  const select = document.getElementById('repair-remarks');
  const currentValue = select.value;
  select.innerHTML = '<option value="" disabled selected>-- Select Technician --</option>';

  techniciansData.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.name;
    opt.textContent = t.name;
    select.appendChild(opt);
  });

  if (currentValue) select.value = currentValue;
}

async function handleAddTechnician(e) {
  e.preventDefault();
  const input = document.getElementById('new-tech-name');
  const name = input.value.trim();
  if (!name) return;

  try {
    const res = await fetch('/api/technicians', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    if (res.ok) {
      input.value = '';
      await loadTechnicians();
      await refreshDashboardStats();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to add technician');
    }
  } catch (err) {
    console.error('Add technician error:', err);
  }
}

async function deleteTechnician(id) {
  if (!confirm('Are you sure you want to remove this technician?')) return;
  try {
    const res = await fetch(`/api/technicians/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await loadTechnicians();
      await refreshDashboardStats();
    }
  } catch (err) {
    console.error('Delete technician error:', err);
  }
}

/* --- EXPORT TO EXCEL --- */
function exportToExcel() {
  const url = currentFilterPC === 'ALL' 
    ? '/api/export/excel' 
    : `/api/export/excel?computerId=${currentFilterPC}`;
  window.location.href = url;
}

/* --- SEARCH & UTILITIES --- */
function handleSearch(term) {
  const query = term.toLowerCase().trim();
  if (!query) {
    renderInventory();
    return;
  }

  const filtered = inventoryData.filter(comp => {
    const matchMeta = (comp.property_name || '').toLowerCase().includes(query) ||
                      (comp.property_code || '').toLowerCase().includes(query) ||
                      (comp.location || '').toLowerCase().includes(query) ||
                      (comp.department || '').toLowerCase().includes(query);

    const matchParts = (comp.parts || []).some(p => 
      (p.item_type || '').toLowerCase().includes(query) ||
      (p.brand || '').toLowerCase().includes(query) ||
      (p.model || '').toLowerCase().includes(query) ||
      (p.serial_number || '').toLowerCase().includes(query) ||
      (p.specs || '').toLowerCase().includes(query)
    );

    const matchHistory = (comp.history || []).some(h => 
      (h.item || '').toLowerCase().includes(query) ||
      (h.description || '').toLowerCase().includes(query) ||
      (h.remarks || '').toLowerCase().includes(query)
    );

    return matchMeta || matchParts || matchHistory;
  });

  renderInventory(filtered);
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}