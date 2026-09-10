const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.use(session({
  secret: 'super-secret-inventory-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// In-Memory Data Store
let technicians = [
  { id: 't1', name: 'Reinner' },
  { id: 't2', name: 'Joram' }
];

let computers = [
  {
    id: 'c1',
    property_name: 'r3com11',
    property_code: '168-r3com11',
    location: 'room3',
    department: 'mis',
    drp1: 'reinner',
    drp2: 'joram',
    parts: [
      { id: 'p1', item_type: 'CPU', brand: 'Intel', model: 'i5-12400', specs: '2.5GHz 6-Core', serial_number: 'SN12345', date_purchased: '2024-01-15' }
    ],
    history: [
      { id: 'h1', log_date: '2025-12-16', item: 'Keyboard', description: 'Replaced faulty keys', remarks: 'Reinner' }
    ]
  }
];

// Helper Auth Middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized. Please log in.' });
};

/* Authentication Routes */

app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  // Simple default credentials for demo/production setup
  if (username === 'admin' && password === 'admin123') {
    req.session.user = { username: 'admin', role: 'administrator' };
    return res.json({ success: true, user: req.session.user });
  }
  res.status(401).json({ error: 'Invalid username or password' });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

/* Dashboard & Stats Routes */

app.get('/api/dashboard/stats', (req, res) => {
  let totalParts = 0;
  let totalRepairs = 0;

  computers.forEach(c => {
    totalParts += (c.parts || []).length;
    totalRepairs += (c.history || []).length;
  });

  res.json({
    totalComputers: computers.length,
    totalParts,
    totalRepairs,
    totalTechs: technicians.length
  });
});

/* Export Route */

app.get('/api/export/excel', requireAuth, (req, res) => {
  let csv = 'Computer Code,Computer Name,Location,Department,DRP1,DRP2,Part Type,Part Brand/Model,Part SN,Repair Date,Repair Item,Repair Tech\n';

  computers.forEach(c => {
    const base = `"${c.property_code}","${c.property_name}","${c.location || ''}","${c.department || ''}","${c.drp1 || ''}","${c.drp2 || ''}"`;
    
    if (c.parts.length === 0 && c.history.length === 0) {
      csv += `${base},"","","","","",""\n`;
    } else {
      const maxRows = Math.max(c.parts.length, c.history.length);
      for (let i = 0; i < maxRows; i++) {
        const p = c.parts[i] || {};
        const h = c.history[i] || {};
        const partStr = `"${p.item_type || ''}","${p.brand || ''} ${p.model || ''}","${p.serial_number || ''}"`;
        const repairStr = `"${h.log_date || ''}","${h.item || ''}","${h.remarks || ''}"`;
        csv += `${base},${partStr},${repairStr}\n`;
      }
    }
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="inventory_report.csv"');
  res.send(csv);
});

/* Inventory & Workstation Routes */

app.get('/api/inventory', (req, res) => {
  res.json(computers);
});

app.post('/api/computers', requireAuth, (req, res) => {
  const newComp = {
    id: Date.now().toString(),
    ...req.body,
    parts: [],
    history: []
  };
  computers.push(newComp);
  res.status(201).json(newComp);
});

app.put('/api/computers/:id', requireAuth, (req, res) => {
  const comp = computers.find(c => c.id === req.params.id);
  if (!comp) return res.status(404).json({ error: 'Computer not found' });

  Object.assign(comp, req.body);
  res.json(comp);
});

app.delete('/api/computers/:id', requireAuth, (req, res) => {
  computers = computers.filter(c => c.id !== req.params.id);
  res.json({ success: true });
});

/* Components / Parts Routes */

app.post('/api/components', requireAuth, (req, res) => {
  const { computer_id, ...partData } = req.body;
  const comp = computers.find(c => c.id === computer_id);
  if (!comp) return res.status(404).json({ error: 'Computer not found' });

  const newPart = { id: Date.now().toString(), ...partData };
  comp.parts.push(newPart);
  res.status(201).json(newPart);
});

app.put('/api/components/:id', requireAuth, (req, res) => {
  let foundPart = null;
  for (const comp of computers) {
    const part = comp.parts.find(p => p.id === req.params.id);
    if (part) {
      Object.assign(part, req.body);
      foundPart = part;
      break;
    }
  }
  if (!foundPart) return res.status(404).json({ error: 'Part not found' });
  res.json(foundPart);
});

app.delete('/api/components/:id', requireAuth, (req, res) => {
  computers.forEach(comp => {
    comp.parts = comp.parts.filter(p => p.id !== req.params.id);
  });
  res.json({ success: true });
});

/* Repair Logs Routes */

app.post('/api/repair-logs', requireAuth, (req, res) => {
  const { computer_id, ...logData } = req.body;
  const comp = computers.find(c => c.id === computer_id);
  if (!comp) return res.status(404).json({ error: 'Computer not found' });

  const newLog = { id: Date.now().toString(), ...logData };
  comp.history.push(newLog);
  res.status(201).json(newLog);
});

app.put('/api/repair-logs/:id', requireAuth, (req, res) => {
  let foundLog = null;
  for (const comp of computers) {
    const log = comp.history.find(h => h.id === req.params.id);
    if (log) {
      Object.assign(log, req.body);
      foundLog = log;
      break;
    }
  }
  if (!foundLog) return res.status(404).json({ error: 'Log not found' });
  res.json(foundLog);
});

app.delete('/api/repair-logs/:id', requireAuth, (req, res) => {
  computers.forEach(comp => {
    comp.history = comp.history.filter(h => h.id !== req.params.id);
  });
  res.json({ success: true });
});

/* Technicians Routes */

app.get('/api/technicians', (req, res) => {
  res.json(technicians);
});

app.post('/api/technicians', requireAuth, (req, res) => {
  const { name } = req.body;
  if (technicians.some(t => t.name.toLowerCase() === name.toLowerCase())) {
    return res.status(400).json({ error: 'Technician already exists' });
  }
  const newTech = { id: Date.now().toString(), name };
  technicians.push(newTech);
  res.status(201).json(newTech);
});

app.delete('/api/technicians/:id', requireAuth, (req, res) => {
  technicians = technicians.filter(t => t.id !== req.params.id);
  res.json({ success: true });
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});