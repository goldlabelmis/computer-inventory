// State Management
let inventoryData = [];
let techniciansData = [];
let selectedComputerId = null;

// DOM Elements
const computerListEl = document.getElementById('computer-list');
const mainContentEl = document.getElementById('main-content');
const searchInput = document.getElementById('search-input');

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  loadInventory();
  loadTechnicians();
});

// Helper: Normalize ID from MongoDB
function getId(item) {
  if (!item) return '';
  return item.id || item._id || '';
}

// Fetch Inventory from Server
async function loadInventory() {
  try {
    const res = await fetch('/api/inventory');
    inventoryData = await res.json();
    renderSidebar();
    
    // Maintain selection or select first PC
    if (selectedComputerId) {
      renderComputerDetails(selectedComputerId);
    } else if (inventoryData.length > 0) {
      selectComputer(getId(inventoryData[0]));
    } else {
      renderEmptyState();
    }
  } catch (err) {
    console.error('Error loading inventory:', err);
  }
}

// Fetch Technicians
async function loadTechnicians() {
  try {
    const res = await fetch('/api/technicians');
    techniciansData = await res.json();
  } catch (err) {
    console.error('Error loading technicians:', err);
  }
}

// Render Sidebar Navigation
function renderSidebar(filteredData = null) {
  const data = filteredData || inventoryData;
  if (!computerListEl) return;

  computerListEl.innerHTML = `
    <button class="nav-item ${selectedComputerId === 'ALL' ? 'active' : ''}" onclick="selectAllPCs()">
      💻 All PCs (${inventoryData.length})
    </button>
    ${data.map(comp => {
      const id = getId(comp);
      return `
        <button class="nav-item ${selectedComputerId === id ? 'active' : ''}" onclick="selectComputer('${id}')">
          🖥️ ${escapeHtml(comp.property_name || 'Unnamed')}
        </button>
      `;
    }).join('')}
  `;
}

// Search Filtering
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = inventoryData.filter(comp => 
      (comp.property_name && comp.property_name.toLowerCase().includes(query)) ||
      (comp.property_code && comp.property_code.toLowerCase().includes(query)) ||
      (comp.location && comp.location.toLowerCase().includes(query)) ||
      (comp.department && comp.department.toLowerCase().includes(query))
    );
    renderSidebar(filtered);
  });
}

function selectComputer(id) {
  selectedComputerId = id;
  renderSidebar();
  renderComputerDetails(id);
}

function selectAllPCs() {
  selectedComputerId = 'ALL';
  renderSidebar();
  renderAllPCsView();
}

// Render Details for Single Computer
function renderComputerDetails(id) {
  const comp = inventoryData.find(c => getId(c) === id);
  if (!comp) return renderEmptyState();

  const compId = getId(comp);

  mainContentEl.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <span class="label">CODE</span>
          <h3>${escapeHtml(comp.property_code)}</h3>
        </div>
        <div>
          <span class="label">NAME</span>
          <h3>${escapeHtml(comp.property_name)}</h3>
        </div>
        <div>
          <span class="label">LOCATION</span>
          <p>${escapeHtml(comp.location || '-')}</p>
        </div>
        <div>
          <span class="label">DEPT</span>
          <p>${escapeHtml(comp.department || '-')}</p>
        </div>
        <div>
          <span class="label">DRP 1</span>
          <p>${escapeHtml(comp.drp1 || '-')}</p>
        </div>
        <div>
          <span class="label">DRP 2</span>
          <p>${escapeHtml(comp.drp2 || '-')}</p>
        </div>
        <div class="actions">
          <button class="btn btn-warning" onclick="openEditWorkstationModal('${compId}')">✏️ Edit</button>
          <button class="btn btn-danger" onclick="deleteWorkstation('${compId}')">Delete Unit</button>
        </div>
      </div>

      <!-- Parts & Peripherals Section -->
      <div class="section-header">
        <h4>Parts & Peripherals</h4>
        <button class="btn btn-sm btn-outline" onclick="openAddPartModal('${compId}')">+ Add Part</button>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>TYPE</th>
            <th>BRAND/MODEL</th>
            <th>SPECS / SN</th>
            <th>DATE</th>
            <th>ACTION</th>
          </tr>
        </thead>
        <tbody>
          ${(comp.parts && comp.parts.length > 0) ? comp.parts.map(p => {
            const partId = getId(p);
            return `
              <tr>
                <td>${escapeHtml(p.item_type || '-')}</td>
                <td>${escapeHtml(p.brand || '')} ${escapeHtml(p.model || '')}</td>
                <td>${escapeHtml(p.specs || '')} ${p.serial_number ? `(S/N: ${escapeHtml(p.serial_number)})` : ''}</td>
                <td>${escapeHtml(p.date_purchased || '-')}</td>
                <td>
                  <button class="btn-icon" onclick="deletePart('${partId}')">🗑️</button>
                </td>
              </tr>
            `;
          }).join('') : `<tr><td colspan="5" class="empty-text">No parts recorded.</td></tr>`}
        </tbody>
      </table>

      <!-- Repair Logs Section -->
      <div class="section-header">
        <h4>🛠️ Maintenance & Repair History</h4>
        <button class="btn btn-sm btn-outline" onclick="openAddRepairModal('${compId}')">+ Log Repair</button>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>DATE</th>
            <th>ITEM</th>
            <th>DESCRIPTION</th>
            <th>TECH</th>
            <th>ACTION</th>
          </tr>
        </thead>
        <tbody>
          ${(comp.history && comp.history.length > 0) ? comp.history.map(h => {
            const logId = getId(h);
            return `
              <tr>
                <td>${escapeHtml(h.log_date || '-')}</td>
                <td>${escapeHtml(h.item || '-')}</td>
                <td>${escapeHtml(h.description || '-')} ${h.remarks ? `<br><small>${escapeHtml(h.remarks)}</small>` : ''}</td>
                <td>${escapeHtml(h.remarks || '-')}</td>
                <td>
                  <button class="btn-icon" onclick="deleteRepairLog('${logId}')">🗑️</button>
                </td>
              </tr>
            `;
          }).join('') : `<tr><td colspan="5" class="empty-text">No repair logs recorded.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

// Render "All PCs" Summary Table
function renderAllPCsView() {
  mainContentEl.innerHTML = `
    <div class="card">
      <h3>All Workstations</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>CODE</th>
            <th>NAME</th>
            <th>LOCATION</th>
            <th>DEPT</th>
            <th>DRP 1</th>
            <th>ACTION</th>
          </tr>
        </thead>
        <tbody>
          ${inventoryData.map(comp => {
            const compId = getId(comp);
            return `
              <tr>
                <td><b>${escapeHtml(comp.property_code)}</b></td>
                <td>${escapeHtml(comp.property_name)}</td>
                <td>${escapeHtml(comp.location || '-')}</td>
                <td>${escapeHtml(comp.department || '-')}</td>
                <td>${escapeHtml(comp.drp1 || '-')}</td>
                <td>
                  <button class="btn btn-sm" onclick="selectComputer('${compId}')">Show Details</button>
                  <button class="btn btn-sm btn-warning" onclick="openEditWorkstationModal('${compId}')">✏️ Edit</button>
                  <button class="btn btn-sm btn-danger" onclick="deleteWorkstation('${compId}')">Delete</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderEmptyState() {
  mainContentEl.innerHTML = `<div class="card"><p class="empty-text">No workstation selected or list is empty.</p></div>`;
}

/* API ACTIONS */

async function deleteWorkstation(id) {
  if (!confirm('Are you sure you want to delete this workstation?')) return;
  try {
    await fetch(`/api/computers/${id}`, { method: 'DELETE' });
    selectedComputerId = null;
    loadInventory();
  } catch (err) {
    alert('Failed to delete workstation: ' + err.message);
  }
}

async function deletePart(partId) {
  if (!confirm('Remove this part?')) return;
  try {
    await fetch(`/api/components/${partId}`, { method: 'DELETE' });
    loadInventory();
  } catch (err) {
    alert('Failed to delete part: ' + err.message);
  }
}

async function deleteRepairLog(logId) {
  if (!confirm('Delete this repair log?')) return;
  try {
    await fetch(`/api/repair-logs/${logId}`, { method: 'DELETE' });
    loadInventory();
  } catch (err) {
    alert('Failed to delete log: ' + err.message);
  }
}

// Modal Handlers & Technicians Management
function openTechniciansModal() {
  const modal = document.getElementById('tech-modal');
  if (!modal) return;
  renderTechniciansList();
  modal.classList.add('show');
}

function closeTechniciansModal() {
  const modal = document.getElementById('tech-modal');
  if (modal) modal.classList.remove('show');
}

function renderTechniciansList() {
  const listEl = document.getElementById('tech-list');
  if (!listEl) return;
  listEl.innerHTML = techniciansData.map(t => {
    const techId = getId(t);
    return `
      <div class="tech-item">
        <span>👤 ${escapeHtml(t.name)}</span>
        <button class="btn-icon" onclick="deleteTechnician('${techId}')">❌</button>
      </div>
    `;
  }).join('');
}

async function addTechnician() {
  const input = document.getElementById('tech-name-input');
  if (!input || !input.value.trim()) return;
  
  try {
    await fetch('/api/technicians', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: input.value.trim() })
    });
    input.value = '';
    await loadTechnicians();
    renderTechniciansList();
  } catch (err) {
    alert('Error adding technician: ' + err.message);
  }
}

async function deleteTechnician(id) {
  try {
    await fetch(`/api/technicians/${id}`, { method: 'DELETE' });
    await loadTechnicians();
    renderTechniciansList();
  } catch (err) {
    alert('Error deleting technician: ' + err.message);
  }
}

// Helper: XSS Protection
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}