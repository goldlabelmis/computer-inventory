let inventory = [];
let technicians = [];
let selectedPCId = 'ALL';
let expandedCards = {};
let currentUser = null;

// GLOBAL MODAL CONTROLS
window.openModal = function(id) { 
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active'); 
};

window.closeModal = function(id) { 
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('active');

    if (id === 'workstation-modal') {
      document.getElementById('edit-comp-id').value = '';
      document.getElementById('workstation-modal-title').innerText = 'Add Workstation';
      document.getElementById('add-workstation-form').reset();
    }
    if (id === 'part-modal') {
      document.getElementById('part-id').value = '';
      document.getElementById('part-modal-title').innerText = 'Add Part';
      document.getElementById('add-part-form').reset();
    }
    if (id === 'repair-modal') {
      document.getElementById('repair-id').value = '';
      document.getElementById('repair-modal-title').innerText = 'Log Repair';
      document.getElementById('add-repair-form').reset();
    }
    if (id === 'import-modal') {
      document.getElementById('import-inventory-form')?.reset();
      const statusBox = document.getElementById('import-status-box');
      if (statusBox) statusBox.innerText = '';
    }
  }
};

window.onclick = function(event) {
  if (event.target.classList.contains('modal')) {
    event.target.classList.remove('active');
  }
};

function getId(obj) {
  return obj ? (obj.id || obj._id || '') : '';
}

function isAdmin() {
  return currentUser && currentUser.role === 'administrator';
}

document.addEventListener('DOMContentLoaded', () => {
  // DISABLE AUTOCOMPLETE & PREVENT PASSWORD AUTOFILL SITE-WIDE
  const applyAutofillProtections = () => {
    document.querySelectorAll('input').forEach(input => {
      input.setAttribute('autocomplete', 'off');
      if (input.type === 'password') {
        input.setAttribute('autocomplete', 'new-password');
      }
    });
  };

  applyAutofillProtections();

  // Watch for dynamically rendered inputs (modals, forms)
  const observer = new MutationObserver(() => {
    applyAutofillProtections();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  checkAuth();
  loadInventory();
  loadTechnicians();

  // SIDEBAR TOGGLE HANDLER
  const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
  const appSidebar = document.getElementById('app-sidebar') || document.querySelector('.sidebar');
  if (sidebarToggleBtn && appSidebar) {
    sidebarToggleBtn.addEventListener('click', () => {
      appSidebar.classList.toggle('collapsed');
    });
  }

  document.getElementById('search-input')?.addEventListener('input', () => filterData());

  // LOGIN FORM
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        if (res.ok) {
          closeModal('login-modal');
          await checkAuth();
          loadInventory();
        } else {
          alert('Invalid credentials!');
        }
      } catch (err) {
        alert('Login failed: ' + err.message);
      }
    };
  }

  // WORKSTATION FORM
  const workstationForm = document.getElementById('add-workstation-form');
  if (workstationForm) {
    workstationForm.onsubmit = async (e) => {
      e.preventDefault();
      const editId = document.getElementById('edit-comp-id').value;
      const payload = {
        property_name: document.getElementById('prop-name').value,
        property_code: document.getElementById('prop-code').value,
        location: document.getElementById('prop-loc').value,
        department: document.getElementById('prop-dept').value,
        drp1: document.getElementById('prop-drp1').value,
        drp2: document.getElementById('prop-drp2').value
      };

      const url = editId ? `/api/computers/${editId}` : '/api/computers';
      const method = editId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.status === 401 || res.status === 403) return alert('Admin access required.');

      closeModal('workstation-modal');
      loadInventory();
    };
  }

  // PART FORM
  const partForm = document.getElementById('add-part-form');
  if (partForm) {
    partForm.onsubmit = async (e) => {
      e.preventDefault();
      const partId = document.getElementById('part-id').value;
      const payload = {
        computer_id: document.getElementById('part-comp-id').value,
        item_type: document.getElementById('part-type').value,
        brand: document.getElementById('part-brand').value,
        model: document.getElementById('part-model').value,
        specs: document.getElementById('part-specs').value,
        serial_number: document.getElementById('part-sn').value,
        date_purchased: document.getElementById('part-date').value
      };

      const url = partId ? `/api/components/${partId}` : '/api/components';
      const method = partId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.status === 401 || res.status === 403) return alert('Admin access required.');

      closeModal('part-modal');
      loadInventory();
    };
  }

  // REPAIR FORM
  const repairForm = document.getElementById('add-repair-form');
  if (repairForm) {
    repairForm.onsubmit = async (e) => {
      e.preventDefault();
      const repairId = document.getElementById('repair-id').value;
      const payload = {
        computer_id: document.getElementById('repair-comp-id').value,
        log_date: document.getElementById('repair-date').value,
        item: document.getElementById('repair-item').value,
        description: document.getElementById('repair-desc').value,
        remarks: document.getElementById('repair-remarks').value
      };

      const url = repairId ? `/api/repair-logs/${repairId}` : '/api/repair-logs';
      const method = repairId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.status === 401 || res.status === 403) return alert('Admin access required.');

      closeModal('repair-modal');
      loadInventory();
    };
  }

  // TECHNICIAN FORM
  const techForm = document.getElementById('add-tech-form');
  if (techForm) {
    techForm.onsubmit = async (e) => {
      e.preventDefault();
      const input = document.getElementById('new-tech-name');
      const name = input.value.trim();
      if (!name) return;

      const res = await fetch('/api/technicians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });

      if (res.status === 401 || res.status === 403) return alert('Admin access required.');

      if (res.ok) {
        input.value = '';
        loadTechnicians();
      } else {
        alert('Technician already exists or failed to add.');
      }
    };
  }

  // SPREADSHEET IMPORT FORM
  const importForm = document.getElementById('import-inventory-form');
  if (importForm) {
    importForm.onsubmit = handleSpreadsheetImport;
  }
});

/* AUTH & DASHBOARD FUNCTIONS */
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    currentUser = data.user;

    const userInfoEl = document.getElementById('user-info');
    const authBtn = document.getElementById('auth-btn');

    if (currentUser) {
      if (userInfoEl) userInfoEl.innerHTML = `<span>Logged in as: <b>${currentUser.username}</b> (${currentUser.role})</span>`;
      if (authBtn) {
        authBtn.innerText = '🔓 Logout';
        authBtn.className = 'btn btn-danger';
        authBtn.onclick = logout;
      }
      loadDashboardStats();
    } else {
      if (userInfoEl) userInfoEl.innerHTML = `<span>View Only Mode</span>`;
      if (authBtn) {
        authBtn.innerText = '🔒 Login';
        authBtn.className = 'btn btn-secondary';
        authBtn.onclick = () => openModal('login-modal');
      }
      updateDashboardUI(inventory.length, 0, 0, technicians.length);
    }

    toggleAdminControls();
    renderTechManageList(); // Refresh list UI after currentUser role resolved
    filterData();
  } catch (err) {
    console.error('Auth check error:', err);
  }
}

function toggleAdminControls() {
  document.body.classList.toggle('is-admin', isAdmin());
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  currentUser = null;
  checkAuth();
  loadInventory();
}

async function loadDashboardStats() {
  try {
    const res = await fetch('/api/dashboard/stats');
    if (!res.ok) return calculateLocalStats();
    const stats = await res.json();
    updateDashboardUI(stats.totalComputers, stats.totalParts, stats.totalRepairs, stats.totalTechs);
  } catch (err) {
    calculateLocalStats();
  }
}

function calculateLocalStats() {
  let totalParts = 0;
  let totalRepairs = 0;
  inventory.forEach(item => {
    totalParts += (item.parts || []).length;
    totalRepairs += (item.history || []).length;
  });
  updateDashboardUI(inventory.length, totalParts, totalRepairs, technicians.length);
}

function updateDashboardUI(pcs, parts, repairs, techs) {
  const pcEl = document.getElementById('stat-pcs');
  const partEl = document.getElementById('stat-parts');
  const repairEl = document.getElementById('stat-repairs');
  const techEl = document.getElementById('stat-techs');

  if (pcEl) pcEl.innerText = pcs;
  if (partEl) partEl.innerText = parts;
  if (repairEl) repairEl.innerText = repairs;
  if (techEl) techEl.innerText = techs;
}

function exportToExcel() {
  if (!isAdmin()) {
    alert('Admin privileges required to export inventory reports.');
    return openModal('login-modal');
  }
  window.location.href = `/api/export/excel?computerId=${encodeURIComponent(selectedPCId)}`;
}

/* SPREADSHEET IMPORT FUNCTIONS */
function openImportModal() {
  if (!isAdmin()) {
    alert('Admin privileges required to import inventory.');
    return openModal('login-modal');
  }
  const form = document.getElementById('import-inventory-form');
  const statusBox = document.getElementById('import-status-box');
  if (form) form.reset();
  if (statusBox) statusBox.innerText = '';
  openModal('import-modal');
}

function normalizeRowKeys(row) {
  const normalized = {};
  Object.keys(row || {}).forEach(key => {
    const cleanKey = String(key).trim().toLowerCase().replace(/[\s\-]+/g, '_');
    normalized[cleanKey] = row[key] !== undefined && row[key] !== null ? String(row[key]).trim() : '';
  });
  return normalized;
}

function pickField(row, keys) {
  for (const k of keys) {
    if (row[k]) return row[k];
  }
  return '';
}

async function handleSpreadsheetImport(e) {
  e.preventDefault();
  if (!isAdmin()) return alert('Admin access required.');

  const fileInput = document.getElementById('import-file-input');
  const statusBox = document.getElementById('import-status-box');
  const submitBtn = document.getElementById('import-submit-btn');
  const file = fileInput?.files?.[0];

  if (!file) return alert('Please select a spreadsheet file first.');
  if (typeof XLSX === 'undefined') return alert('Spreadsheet parser (SheetJS) failed to load.');

  submitBtn.disabled = true;
  statusBox.innerText = 'Reading spreadsheet...';

  try {
    if (!technicians.length) {
      await loadTechnicians();
    }

    const knownTechNames = new Set(
      (technicians || []).map(t => String(t.name || '').trim().toLowerCase()).filter(Boolean)
    );

    const resolveTechnician = (rawTech) => {
      const cleaned = String(rawTech || '').trim();
      if (!cleaned) return 'N/A';
      return knownTechNames.has(cleaned.toLowerCase()) ? cleaned : 'N/A';
    };

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rawRows.length) {
      statusBox.innerText = 'No data rows found in the spreadsheet.';
      submitBtn.disabled = false;
      return;
    }

    const groupedPCs = new Map();

    rawRows.forEach(rawRow => {
      const r = normalizeRowKeys(rawRow);
      const pcCode = pickField(r, ['property_code', 'pc_code', 'code']);
      const pcName = pickField(r, ['property_name', 'pc_name', 'computer_name', 'name']);
      const groupKey = (pcCode || pcName).toLowerCase();
      if (!groupKey) return;

      if (!groupedPCs.has(groupKey)) {
        groupedPCs.set(groupKey, {
          computer: {
            property_name: pcName || pcCode,
            property_code: pcCode || pcName,
            location: pickField(r, ['location', 'room']),
            department: pickField(r, ['department', 'dept']),
            drp1: pickField(r, ['drp1', 'drp_1']),
            drp2: pickField(r, ['drp2', 'drp_2'])
          },
          parts: [],
          repairs: []
        });
      }

      const itemType = pickField(r, ['item_type', 'part_type', 'component_type', 'type']);
      const brand = pickField(r, ['brand', 'part_brand']);
      const model = pickField(r, ['model', 'part_model']);
      const specs = pickField(r, ['specs', 'specifications', 'spec']);
      const serialNumber = pickField(r, ['serial_number', 'serial', 'sn']);
      const datePurchased = pickField(r, ['date_purchased', 'purchase_date', 'date']);

      if (itemType || brand || model || specs || serialNumber) {
        groupedPCs.get(groupKey).parts.push({
          item_type: itemType || 'Component',
          brand,
          model,
          specs,
          serial_number: serialNumber,
          date_purchased: datePurchased
        });
      }

      const repairItem = pickField(r, ['repair_item', 'issue', 'problem']);
      const repairDesc = pickField(r, ['repair_description', 'description', 'work_done', 'action_taken']);
      const repairDate = pickField(r, ['log_date', 'repair_date']);
      const rawTech = pickField(r, ['technician', 'tech', 'tech_name', 'technician_name', 'remarks', 'assigned_to']);

      if (repairItem || repairDesc || rawTech) {
        groupedPCs.get(groupKey).repairs.push({
          log_date: repairDate || new Date().toISOString().slice(0, 10),
          item: repairItem || 'Maintenance / Work',
          description: repairDesc || 'Imported work log',
          remarks: resolveTechnician(rawTech)
        });
      }
    });

    let createdPCs = 0;
    let createdParts = 0;
    let createdRepairs = 0;
    const entries = Array.from(groupedPCs.values());

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      statusBox.innerText = `Importing workstation ${i + 1} of ${entries.length} (${entry.computer.property_name})...`;

      const existingComp = inventory.find(c =>
        (c.property_code && entry.computer.property_code && c.property_code.toLowerCase() === entry.computer.property_code.toLowerCase()) ||
        (c.property_name && entry.computer.property_name && c.property_name.toLowerCase() === entry.computer.property_name.toLowerCase())
      );

      let computerId = existingComp ? getId(existingComp) : '';

      if (!computerId) {
        const compRes = await fetch('/api/computers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry.computer)
        });

        if (compRes.status === 401 || compRes.status === 403) {
          throw new Error('Admin access required.');
        }
        if (!compRes.ok) {
          throw new Error(`Failed to create workstation "${entry.computer.property_name}".`);
        }

        const createdComp = await compRes.json();
        computerId = getId(createdComp.data || createdComp);
        createdPCs++;
      }

      for (const part of entry.parts) {
        const partRes = await fetch('/api/components', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            computer_id: computerId,
            ...part
          })
        });

        if (partRes.ok) {
          createdParts++;
        }
      }

      for (const repair of entry.repairs) {
        const repairRes = await fetch('/api/repair-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            computer_id: computerId,
            ...repair
          })
        });

        if (repairRes.ok) {
          createdRepairs++;
        }
      }
    }

    await loadInventory();
    statusBox.innerText = `Done! Created ${createdPCs} PC(s), ${createdParts} part(s), and ${createdRepairs} log(s).`;
    setTimeout(() => closeModal('import-modal'), 900);
  } catch (err) {
    console.error('Import error:', err);
    statusBox.innerText = `Import failed: ${err.message}`;
  } finally {
    submitBtn.disabled = false;
  }
}

/* DATA LOADERS & RENDERERS */
async function loadInventory() {
  const res = await fetch('/api/inventory');
  inventory = await res.json();
  renderSidebar();
  filterData();
  calculateLocalStats();
}

async function loadTechnicians() {
  const res = await fetch('/api/technicians');
  technicians = await res.json();
  populateTechDropdown();
  renderTechManageList();
  calculateLocalStats();
}

function populateTechDropdown() {
  const select = document.getElementById('repair-remarks');
  if (!select) return;
  select.innerHTML = '<option value="" disabled selected>-- Select Technician --</option>';
  technicians.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.name;
    opt.textContent = t.name;
    select.appendChild(opt);
  });
}

function renderTechManageList() {
  const list = document.getElementById('tech-manage-list');
  if (!list) return;
  list.innerHTML = technicians.length ? '' : '<li style="text-align:center; padding:0.5rem; color:#94a3b8;">No technicians found.</li>';
  
  technicians.forEach(t => {
    const techId = getId(t);
    const li = document.createElement('li');
    li.className = 'tech-item';
    li.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid #e2e8f0;';
    
    li.innerHTML = `
      <span>👤 ${t.name}</span>
      ${isAdmin() ? `<button class="btn btn-sm btn-danger" style="padding: 2px 8px; cursor: pointer;" onclick="deleteTech('${techId}')">❌</button>` : ''}
    `;
    list.appendChild(li);
  });
}

async function deleteTech(id) {
  if (!isAdmin()) return alert('Admin access required.');
  if (confirm('Remove this technician?')) {
    const res = await fetch(`/api/technicians/${id}`, { method: 'DELETE' });
    if (res.status === 401 || res.status === 403) return alert('Admin access required.');
    loadTechnicians();
  }
}

function renderSidebar() {
  const sidebar = document.getElementById('pc-list-sidebar');
  if (!sidebar) return;
  sidebar.innerHTML = `
    <li class="${selectedPCId === 'ALL' ? 'active' : ''}" onclick="filterByPC('ALL')">
      <span class="icon">💻</span>
      <span class="label">All PCs</span>
    </li>
  `;

  const sortedInventory = [...inventory].sort((a, b) => 
    (a.property_name || '').localeCompare(b.property_name || '', undefined, { numeric: true, sensitivity: 'base' })
  );

  sortedInventory.forEach(item => {
    const itemId = getId(item);
    const li = document.createElement('li');
    li.className = selectedPCId == itemId ? 'active' : '';
    li.innerHTML = `
      <span class="icon">🖥️</span>
      <span class="label">${item.property_name}</span>
    `;
    li.onclick = () => filterByPC(itemId);
    sidebar.appendChild(li);
  });
}

function filterByPC(id) {
  selectedPCId = id;
  expandedCards = {};
  renderSidebar();
  filterData();
}

function filterData() {
  const queryInput = document.getElementById('search-input');
  const query = queryInput ? queryInput.value.toLowerCase() : '';
  let filtered = inventory;

  if (selectedPCId !== 'ALL') {
    filtered = filtered.filter(i => getId(i) == selectedPCId);
  }

  if (query) {
    filtered = filtered.filter(i => 
      (i.property_code || '').toLowerCase().includes(query) || 
      (i.property_name || '').toLowerCase().includes(query) || 
      (i.location || '').toLowerCase().includes(query) ||
      (i.department || '').toLowerCase().includes(query)
    );
  }

  // Sort main cards alphabetically by property_name to match sidebar order
  filtered.sort((a, b) => 
    (a.property_name || '').localeCompare(b.property_name || '', undefined, { numeric: true, sensitivity: 'base' })
  );

  render(filtered);
}

function toggleDetails(id) {
  expandedCards[id] = !expandedCards[id];
  filterData();
}

function render(data) {
  const container = document.getElementById('inventory-list');
  if (!container) return;
  container.innerHTML = data.length ? '' : '<p style="text-align:center; padding: 2rem;">No records found.</p>';

  data.forEach(item => {
    const itemId = getId(item);
    const isSingleSelection = selectedPCId !== 'ALL';
    const isExpanded = isSingleSelection ? true : !!expandedCards[itemId];

    const actionHeader = isAdmin() ? '<th>Action</th>' : '';
    const tableColspan = isAdmin() ? 5 : 4;

    const partsRows = (item.parts || []).map(p => {
      const partId = getId(p);
      return `
        <tr>
          <td><strong>${p.item_type || '-'}</strong></td>
          <td>${p.brand || ''} ${p.model || ''}</td>
          <td>${p.specs || ''} ${p.serial_number ? '(SN: ' + p.serial_number + ')' : ''}</td>
          <td>${p.date_purchased || '-'}</td>
          ${isAdmin() ? `
            <td style="white-space: nowrap;">
              <button class="btn btn-sm btn-warning" onclick="editPart('${itemId}', '${partId}')">✏️</button>
              <button class="btn btn-sm btn-danger" onclick="deletePart('${partId}')">❌</button>
            </td>
          ` : ''}
        </tr>
      `;
    }).join('');

    const repairRows = (item.history || []).map(h => {
      const repairId = getId(h);
      return `
        <tr>
          <td>${h.log_date || '-'}</td>
          <td><strong>${h.item || '-'}</strong></td>
          <td>${h.description || '-'}</td>
          <td>${h.remarks || '-'}</td>
          ${isAdmin() ? `
            <td style="white-space: nowrap;">
              <button class="btn btn-sm btn-warning" onclick="editRepair('${itemId}', '${repairId}')">✏️</button>
              <button class="btn btn-sm btn-danger" onclick="deleteRepair('${repairId}')">❌</button>
            </td>
          ` : ''}
        </tr>
      `;
    }).join('');

    const card = document.createElement('div');
    card.className = 'device-card';
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div class="device-meta" style="flex: 1;">
          <div class="meta-item"><label>CODE</label><span>${item.property_code || '-'}</span></div>
          <div class="meta-item"><label>NAME</label><span>${item.property_name || '-'}</span></div>
          <div class="meta-item"><label>LOCATION</label><span>${item.location || '-'}</span></div>
          <div class="meta-item"><label>DEPT</label><span>${item.department || '-'}</span></div>
          <div class="meta-item"><label>DRP 1</label><span>${item.drp1 || '-'}</span></div>
          <div class="meta-item"><label>DRP 2</label><span>${item.drp2 || '-'}</span></div>
        </div>
        <div class="card-actions">
          ${!isSingleSelection ? `
            <button class="btn btn-sm btn-outline" onclick="toggleDetails('${itemId}')">
              ${isExpanded ? 'Hide Details' : 'Show Details'}
            </button>
          ` : ''}
          ${isAdmin() ? `
            <button class="btn btn-sm btn-warning" onclick="editWorkstation('${itemId}')">✏️ Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteComp('${itemId}')">Delete Unit</button>
          ` : ''}
        </div>
      </div>

      ${isExpanded ? `
      <div class="details-section" style="margin-top: 1.5rem; border-top: 1px solid var(--border); padding-top: 1rem;">
        <div class="sub-header">
          <h4>Parts & Peripherals</h4>
          ${isAdmin() ? `<button class="btn btn-sm btn-outline" onclick="openPartModal('${itemId}')">+ Add Part</button>` : ''}
        </div>
        <table>
          <thead><tr><th>Type</th><th>Brand/Model</th><th>Specs / SN</th><th>Date</th>${actionHeader}</tr></thead>
          <tbody>${partsRows || `<tr><td colspan="${tableColspan}">No parts recorded.</td></tr>`}</tbody>
        </table>

        <div class="sub-header">
          <h4>🛠️ Maintenance & Repair History</h4>
          ${isAdmin() ? `<button class="btn btn-sm btn-outline" onclick="openRepairModal('${itemId}')">+ Log Repair</button>` : ''}
        </div>
        <table>
          <thead><tr><th>Date</th><th>Item</th><th>Description</th><th>Tech</th>${actionHeader}</tr></thead>
          <tbody>${repairRows || `<tr><td colspan="${tableColspan}">No repair logs recorded.</td></tr>`}</tbody>
        </table>
      </div>
      ` : ''}
    `;
    container.appendChild(card);
  });
}

/* EDIT/OPEN HANDLERS */
function openPartModal(compId) { 
  if (!isAdmin()) return alert('Admin access required.');
  document.getElementById('part-id').value = '';
  document.getElementById('part-comp-id').value = compId; 
  document.getElementById('part-modal-title').innerText = 'Add Part';
  openModal('part-modal'); 
}

function openRepairModal(compId) { 
  if (!isAdmin()) return alert('Admin access required.');
  document.getElementById('repair-id').value = '';
  document.getElementById('repair-comp-id').value = compId; 
  document.getElementById('repair-modal-title').innerText = 'Log Repair';
  openModal('repair-modal'); 
}

function openTechModal() { 
  if (!isAdmin()) return alert('Admin access required.');
  openModal('tech-modal'); 
}

function editWorkstation(id) {
  if (!isAdmin()) return alert('Admin access required.');
  const item = inventory.find(c => getId(c) === id);
  if (!item) return;

  document.getElementById('edit-comp-id').value = getId(item);
  document.getElementById('prop-name').value = item.property_name || '';
  document.getElementById('prop-code').value = item.property_code || '';
  document.getElementById('prop-loc').value = item.location || '';
  document.getElementById('prop-dept').value = item.department || '';
  document.getElementById('prop-drp1').value = item.drp1 || '';
  document.getElementById('prop-drp2').value = item.drp2 || '';

  document.getElementById('workstation-modal-title').innerText = 'Edit Workstation';
  openModal('workstation-modal');
}

function editPart(compId, partId) {
  if (!isAdmin()) return alert('Admin access required.');
  const comp = inventory.find(c => getId(c) === compId);
  if (!comp) return;
  const part = (comp.parts || []).find(p => getId(p) === partId);
  if (!part) return;

  document.getElementById('part-id').value = getId(part);
  document.getElementById('part-comp-id').value = compId;
  document.getElementById('part-type').value = part.item_type || '';
  document.getElementById('part-brand').value = part.brand || '';
  document.getElementById('part-model').value = part.model || '';
  document.getElementById('part-date').value = part.date_purchased || '';
  document.getElementById('part-sn').value = part.serial_number || '';
  document.getElementById('part-specs').value = part.specs || '';

  document.getElementById('part-modal-title').innerText = 'Edit Part';
  openModal('part-modal');
}

function editRepair(compId, repairId) {
  if (!isAdmin()) return alert('Admin access required.');
  const comp = inventory.find(c => getId(c) === compId);
  if (!comp) return;
  const log = (comp.history || []).find(h => getId(h) === repairId);
  if (!log) return;

  document.getElementById('repair-id').value = getId(log);
  document.getElementById('repair-comp-id').value = compId;
  document.getElementById('repair-date').value = log.log_date || '';
  document.getElementById('repair-item').value = log.item || '';
  document.getElementById('repair-desc').value = log.description || '';
  document.getElementById('repair-remarks').value = log.remarks || '';

  document.getElementById('repair-modal-title').innerText = 'Edit Repair Log';
  openModal('repair-modal');
}

/* DELETE OPERATIONS */
async function deleteComp(id) { 
  if (!isAdmin()) return alert('Admin access required.');
  if (confirm('Delete workstation?')) { 
    const res = await fetch(`/api/computers/${id}`, { method: 'DELETE' }); 
    if (res.status === 401 || res.status === 403) return alert('Admin access required.');
    loadInventory(); 
  } 
}

async function deletePart(id) { 
  if (!isAdmin()) return alert('Admin access required.');
  if (confirm('Delete part?')) { 
    const res = await fetch(`/api/components/${id}`, { method: 'DELETE' }); 
    if (res.status === 401 || res.status === 403) return alert('Admin access required.');
    loadInventory(); 
  } 
}

async function deleteRepair(id) { 
  if (!isAdmin()) return alert('Admin access required.');
  if (confirm('Delete log?')) { 
    const res = await fetch(`/api/repair-logs/${id}`, { method: 'DELETE' }); 
    if (res.status === 401 || res.status === 403) return alert('Admin access required.');
    loadInventory(); 
  } 
}