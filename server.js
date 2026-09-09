const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./inventory.db');
db.run('PRAGMA foreign_keys = ON;');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS computers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_name TEXT, property_code TEXT UNIQUE,
    location TEXT, department TEXT, drp1 TEXT, drp2 TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS components (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    computer_id INTEGER, item_type TEXT, brand TEXT,
    model TEXT, specs TEXT, serial_number TEXT, date_purchased TEXT,
    FOREIGN KEY(computer_id) REFERENCES computers(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS repair_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    computer_id INTEGER, log_date TEXT, item TEXT,
    description TEXT, remarks TEXT,
    FOREIGN KEY(computer_id) REFERENCES computers(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS technicians (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  )`, () => {
    db.get(`SELECT COUNT(*) as count FROM technicians`, (err, row) => {
      if (row && row.count === 0) {
        const stmt = db.prepare(`INSERT INTO technicians (name) VALUES (?)`);
        ['Joram', 'Reinner', 'Edrian', 'Riel'].forEach(tech => stmt.run(tech));
        stmt.finalize();
      }
    });
  });
});

/* API ENDPOINTS */
app.get('/api/inventory', (req, res) => {
  const query = `
    SELECT c.*, 
      COALESCE((SELECT json_group_array(json_object(
        'id', comp.id, 'item_type', comp.item_type, 'brand', comp.brand, 
        'model', comp.model, 'specs', comp.specs, 'serial_number', comp.serial_number, 'date_purchased', comp.date_purchased
      )) FROM components comp WHERE comp.computer_id = c.id), '[]') as parts,
      COALESCE((SELECT json_group_array(json_object(
        'id', log.id, 'log_date', log.log_date, 'item', log.item, 
        'description', log.description, 'remarks', log.remarks
      )) FROM repair_logs log WHERE log.computer_id = c.id), '[]') as history
    FROM computers c ORDER BY c.property_name ASC`;

  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ ...r, parts: JSON.parse(r.parts), history: JSON.parse(r.history) })));
  });
});

app.post('/api/computers', (req, res) => {
  const { property_name, property_code, location, department, drp1, drp2 } = req.body;
  db.run(`INSERT INTO computers (property_name, property_code, location, department, drp1, drp2) VALUES (?, ?, ?, ?, ?, ?)`,
    [property_name, property_code, location, department, drp1, drp2],
    function(err) { res.json({ id: this.lastID }); }
  );
});

app.put('/api/computers/:id', (req, res) => {
  const { property_name, property_code, location, department, drp1, drp2 } = req.body;
  db.run(`UPDATE computers SET property_name=?, property_code=?, location=?, department=?, drp1=?, drp2=? WHERE id=?`,
    [property_name, property_code, location, department, drp1, drp2, req.params.id],
    function(err) { res.json({ success: true }); }
  );
});

/* PARTS API */
app.post('/api/components', (req, res) => {
  const { computer_id, item_type, brand, model, specs, serial_number, date_purchased } = req.body;
  db.run(`INSERT INTO components (computer_id, item_type, brand, model, specs, serial_number, date_purchased) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [computer_id, item_type, brand, model, specs, serial_number, date_purchased],
    function(err) { res.json({ id: this.lastID }); }
  );
});

app.put('/api/components/:id', (req, res) => {
  const { item_type, brand, model, specs, serial_number, date_purchased } = req.body;
  db.run(`UPDATE components SET item_type=?, brand=?, model=?, specs=?, serial_number=?, date_purchased=? WHERE id=?`,
    [item_type, brand, model, specs, serial_number, date_purchased, req.params.id],
    function(err) { res.json({ success: true }); }
  );
});

/* REPAIR LOGS API */
app.post('/api/repair-logs', (req, res) => {
  const { computer_id, log_date, item, description, remarks } = req.body;
  db.run(`INSERT INTO repair_logs (computer_id, log_date, item, description, remarks) VALUES (?, ?, ?, ?, ?)`,
    [computer_id, log_date, item, description, remarks],
    function(err) { res.json({ id: this.lastID }); }
  );
});

app.put('/api/repair-logs/:id', (req, res) => {
  const { log_date, item, description, remarks } = req.body;
  db.run(`UPDATE repair_logs SET log_date=?, item=?, description=?, remarks=? WHERE id=?`,
    [log_date, item, description, remarks, req.params.id],
    function(err) { res.json({ success: true }); }
  );
});

app.delete('/api/computers/:id', (req, res) => {
  db.run(`DELETE FROM computers WHERE id = ?`, [req.params.id], () => res.json({ success: true }));
});

app.delete('/api/components/:id', (req, res) => {
  db.run(`DELETE FROM components WHERE id = ?`, [req.params.id], () => res.json({ success: true }));
});

app.delete('/api/repair-logs/:id', (req, res) => {
  db.run(`DELETE FROM repair_logs WHERE id = ?`, [req.params.id], () => res.json({ success: true }));
});

/* TECHNICIANS API */
app.get('/api/technicians', (req, res) => {
  db.all(`SELECT * FROM technicians ORDER BY name ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/technicians', (req, res) => {
  const { name } = req.body;
  db.run(`INSERT INTO technicians (name) VALUES (?)`, [name], function(err) {
    if (err) return res.status(400).json({ error: 'Technician already exists or invalid.' });
    res.json({ id: this.lastID, name });
  });
});

app.delete('/api/technicians/:id', (req, res) => {
  db.run(`DELETE FROM technicians WHERE id = ?`, [req.params.id], () => res.json({ success: true }));
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}`));