let inventory = [];
let technicians = [];
let selectedPCId = 'ALL';
let expandedCards = {}; // Tracks details expansion state per card ID

document.addEventListener('DOMContentLoaded', () => {
  loadInventory();
  loadTechnicians();

  document.getElementById('search-input').addEventListener('input', () => filterData());

  // Workstation Form
  document.getElementById('add-workstation-form').onsubmit = async (e) => {
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

    if (editId) {
      await fetch(`/api/computers/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      await fetch('/api/computers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    closeModal('workstation-modal');
    loadInventory();
  };

  // Add / Edit Part Form
  document.getElementById('add-part-form').onsubmit = async (e) => {
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

    if (partId) {
      await fetch(`/api/components/${partId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      await fetch('/api/components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    closeModal('part-modal');
    loadInventory();
  };

  // Add / Edit Repair Form
  document.getElementById('add-repair-form').onsubmit = async (e) => {
    e.preventDefault();
    const repairId = document.getElementById('repair-id').value;
    const payload = {
      computer_id: document.getElementById('repair-comp-id').value,
      log_date: document.getElementById('repair-date').value,
      item: document.getElementById('repair-item').value,
      description: document.getElementById('repair-desc').value,
      remarks: document.getElementById('repair-remarks').value
    };

    if (repairId) {
      await fetch(`/api/repair-logs/${repairId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      await fetch('/api/repair-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    closeModal('repair-modal');
    loadInventory();
  };

  // Technician Form
  document.getElementById('add-tech-form').onsubmit = async (e) => {
    e.preventDefault();
    const input = document.getElementById('new-tech-name');
    const name = input.value.trim();
    if (!name) return;

    const res = await fetch('/api/technicians', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    if (res.ok) {
      input.value = '';
      loadTechnicians();
    } else {
      alert('Technician already exists.');
    }
  };
});

async function loadInventory() {
  const res = await fetch('/api/inventory');
  inventory = await res.json();
  renderSidebar();
  filterData();
}

async function loadTechnicians() {
  const res = await fetch('/api/technicians');
  technicians = await res.json();
  populateTechDropdown();
  renderTechManageList();
}

function populateTechDropdown() {
  const select = document.getElementById('repair-remarks');
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
  list.innerHTML = technicians.length ? '' : '<li style="text-align:center; padding:0.5rem; color:#94a3b8;">No technicians found.</li>';
  
  technicians.forEach(t => {
    const li = document.createElement('li');
    li.className = 'tech-item';
    li.innerHTML = `
      <span>👤 ${t.name}</span>
      <button class="btn btn-sm btn-danger" onclick="deleteTech(${t.id})">❌</button>
    `;
    list.appendChild(li);
  });
}

async function deleteTech(id) {
  if (confirm('Remove this technician?')) {
    await fetch(`/api/technicians/${id}`, { method: 'DELETE' });
    loadTechnicians();
  }
}

// Render Alphabetical Sidebar
function renderSidebar() {
  const sidebar = document.getElementById('pc-list-sidebar');
  sidebar.innerHTML = `<li class="${selectedPCId === 'ALL' ? 'active' : ''}" onclick="filterByPC('ALL')">💻 All PCs</li>`;

  // Sort Alphabetically by property name
  const sortedInventory = [...inventory].sort((a, b) => a.property_name.localeCompare(b.property_name));

  sortedInventory.forEach(item => {
    const li = document.createElement('li');
    li.className = selectedPCId == item.id ? 'active' : '';
    li.innerHTML = `🖥️ ${item.property_name}`;
    li.onclick = () => filterByPC(item.id);
    sidebar.appendChild(li);
  });
}

function filterByPC(id) {
  selectedPCId = id;
  expandedCards = {}; // Clear toggle state when switching sidebar filters
  renderSidebar();
  filterData();
}

function filterData() {
  const query = document.getElementById('search-input').value.toLowerCase();
  let filtered = inventory;

  if (selectedPCId !== 'ALL') {
    filtered = filtered.filter(i => i.id == selectedPCId);
  }

  if (query) {
    filtered = filtered.filter(i => 
      i.property_code.toLowerCase().includes(query) || 
      i.property_name.toLowerCase().includes(query) || 
      i.location.toLowerCase().includes(query) ||
      i.department.toLowerCase().includes(query)
    );
  }

  render(filtered);
}

function toggleDetails(id) {
  expandedCards[id] = !expandedCards[id];
  filterData();
}

function render(data) {
  const container = document.getElementById('inventory-list');
  container.innerHTML = data.length ? '' : '<p style="text-align:center; padding: 2rem;">No records found.</p>';

  data.forEach(item => {
    // If a single computer is selected in the sidebar, force expanded and hide toggle button
    const isSingleSelection = selectedPCId !== 'ALL';
    const isExpanded = isSingleSelection ? true : !!expandedCards[item.id];

    const partsRows = item.parts.map(p => `
      <tr>
        <td><strong>${p.item_type}</strong></td>
        <td>${p.brand || ''} ${p.model || ''}</td>
        <td>${p.specs || ''} ${p.serial_number ? '(SN: ' + p.serial_number + ')' : ''}</td>
        <td>${p.date_purchased || '-'}</td>
        <td style="white-space: nowrap;">
          <button class="btn btn-sm btn-warning" onclick="editPart(${item.id}, ${p.id})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deletePart(${p.id})">❌</button>
        </td>
      </tr>
    `).join('');

    const repairRows = item.history.map(h => `
      <tr>
        <td>${h.log_date}</td>
        <td><strong>${h.item}</strong></td>
        <td>${h.description}</td>
        <td>${h.remarks || '-'}</td>
        <td style="white-space: nowrap;">
          <button class="btn btn-sm btn-warning" onclick="editRepair(${item.id}, ${h.id})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteRepair(${h.id})">❌</button>
        </td>
      </tr>
    `).join('');

    const card = document.createElement('div');
    card.className = 'device-card';
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div class="device-meta" style="flex: 1;">
          <div class="meta-item"><label>CODE</label><span>${item.property_code}</span></div>
          <div class="meta-item"><label>NAME</label><span>${item.property_name}</span></div>
          <div class="meta-item"><label>LOCATION</label><span>${item.location || '-'}</span></div>
          <div class="meta-item"><label>DEPT</label><span>${item.department || '-'}</span></div>
          <div class="meta-item"><label>DRP 1</label><span>${item.drp1 || '-'}</span></div>
          <div class="meta-item"><label>DRP 2</label><span>${item.drp2 || '-'}</span></div>
        </div>
        <div class="card-actions">
          ${!isSingleSelection ? `
            <button class="btn btn-sm btn-outline" onclick="toggleDetails(${item.id})">
              ${isExpanded ? 'Hide Details' : 'Show Details'}
            </button>
          ` : ''}
          <button class="btn btn-sm btn-warning" onclick="editWorkstation(${item.id})">✏️ Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteComp(${item.id})">Delete Unit</button>
        </div>
      </div>

      ${isExpanded ? `
      <div class="details-section" style="margin-top: 1.5rem; border-top: 1px solid var(--border); padding-top: 1rem;">
        <div class="sub-header">
          <h4>Parts & Peripherals</h4>
          <button class="btn btn-sm btn-outline" onclick="openPartModal(${item.id})">+ Add Part</button>
        </div>
        <table>
          <thead><tr><th>Type</th><th>Brand/Model</th><th>Specs / SN</th><th>Date</th><th>Action</th></tr></thead>
          <tbody>${partsRows || '<tr><td colspan="5">No parts recorded.</td></tr>'}</tbody>
        </table>

        <div class="sub-header">
          <h4>🛠️ Maintenance & Repair History</h4>
          <button class="btn btn-sm btn-outline" onclick="openRepairModal(${item.id})">+ Log Repair</button>
        </div>
        <table>
          <thead><tr><th>Date</th><th>Item</th><th>Description</th><th>Tech</th><th>Action</th></tr></thead>
          <tbody>${repairRows || '<tr><td colspan="5">No repair logs recorded.</td></tr>'}</tbody>
        </table>
      </div>
      ` : ''}
    `;
    container.appendChild(card);
  });
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { 
  document.getElementById(id).classList.remove('active'); 
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
}

function openPartModal(compId) { 
  document.getElementById('part-id').value = '';
  document.getElementById('part-comp-id').value = compId; 
  document.getElementById('part-modal-title').innerText = 'Add Part';
  openModal('part-modal'); 
}

function openRepairModal(compId) { 
  document.getElementById('repair-id').value = '';
  document.getElementById('repair-comp-id').value = compId; 
  document.getElementById('repair-modal-title').innerText = 'Log Repair';
  openModal('repair-modal'); 
}

function openTechModal() { openModal('tech-modal'); }

function editWorkstation(id) {
  const item = inventory.find(c => c.id === id);
  if (!item) return;

  document.getElementById('edit-comp-id').value = item.id;
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
  const comp = inventory.find(c => c.id === compId);
  if (!comp) return;
  const part = comp.parts.find(p => p.id === partId);
  if (!part) return;

  document.getElementById('part-id').value = part.id;
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
  const comp = inventory.find(c => c.id === compId);
  if (!comp) return;
  const log = comp.history.find(h => h.id === repairId);
  if (!log) return;

  document.getElementById('repair-id').value = log.id;
  document.getElementById('repair-comp-id').value = compId;
  document.getElementById('repair-date').value = log.log_date || '';
  document.getElementById('repair-item').value = log.item || '';
  document.getElementById('repair-desc').value = log.description || '';
  document.getElementById('repair-remarks').value = log.remarks || '';

  document.getElementById('repair-modal-title').innerText = 'Edit Repair Log';
  openModal('repair-modal');
}

async function deleteComp(id) { if(confirm('Delete workstation?')) { await fetch(`/api/computers/${id}`, {method:'DELETE'}); loadInventory(); } }
async function deletePart(id) { if(confirm('Delete part?')) { await fetch(`/api/components/${id}`, {method:'DELETE'}); loadInventory(); } }
async function deleteRepair(id) { if(confirm('Delete log?')) { await fetch(`/api/repair-logs/${id}`, {method:'DELETE'}); loadInventory(); } }