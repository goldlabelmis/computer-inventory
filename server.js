const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Connect to MongoDB Atlas
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://<username>:<password>@cluster.mongodb.net/computer_inventory?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI)
  .then(() => console.log('🍃 Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// 2. Mongoose Schemas & Models
const PartSchema = new mongoose.Schema({
  item_type: String,
  brand: String,
  model: String,
  specs: String,
  serial_number: String,
  date_purchased: String
});

const RepairSchema = new mongoose.Schema({
  log_date: String,
  item: String,
  description: String,
  remarks: String
});

const ComputerSchema = new mongoose.Schema({
  property_name: { type: String, required: true },
  property_code: { type: String, required: true },
  location: String,
  department: String,
  drp1: String,
  drp2: String,
  parts: [PartSchema],
  history: [RepairSchema]
});

const TechnicianSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
});

const Computer = mongoose.model('Computer', ComputerSchema);
const Technician = mongoose.model('Technician', TechnicianSchema);

// Express Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'super-secret-inventory-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Admin-Only Authorization Middleware
const requireAdmin = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'administrator') {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden. Admin privileges required.' });
};

/* --- AUTH ROUTES --- */
app.get('/api/auth/me', (req, res) => res.json({ user: req.session.user || null }));

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'GLMis' && password === 'GLDOREEN2026') {
    req.session.user = { username: 'GLMis', role: 'administrator' };
    return res.json({ success: true, user: req.session.user });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

/* --- DASHBOARD STATS --- */
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const computers = await Computer.find();
    const totalTechs = await Technician.countDocuments();
    let totalParts = 0;
    let totalRepairs = 0;

    computers.forEach(c => {
      totalParts += (c.parts || []).length;
      totalRepairs += (c.history || []).length;
    });

    res.json({ totalComputers: computers.length, totalParts, totalRepairs, totalTechs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* --- EXPORT EXCEL (.XLSX) OPTIMIZED FOR PRINT --- */
app.get('/api/export/excel', requireAdmin, async (req, res) => {
  try {
    const { computerId } = req.query;

    let query = {};
    if (computerId && computerId !== 'ALL') {
      query = { _id: computerId };
    }

    const computers = await Computer.find(query);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Computer Inventory');

    // Page setup optimized for Landscape printing
    worksheet.pageSetup = {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.2, right: 0.2, top: 0.25, bottom: 0.25, header: 0, footer: 0 }
    };

    // Compact Column Widths
    worksheet.columns = [
      { header: 'No.', key: 'no', width: 4 },
      { header: 'Computer Code', key: 'code', width: 14 },
      { header: 'Computer Name', key: 'name', width: 12 },
      { header: 'Location', key: 'location', width: 16 },
      { header: 'Department', key: 'department', width: 10 },
      { header: 'DRP1', key: 'drp1', width: 12 },
      { header: 'DRP2', key: 'drp2', width: 12 },
      { header: 'System Unit Components (CPU, RAM, Motherboard, SSD, HDD, Case)', key: 'system_components', width: 34 },
      { header: 'Monitor', key: 'monitor', width: 18 },
      { header: 'Keyboard', key: 'keyboard', width: 18 },
      { header: 'Mouse', key: 'mouse', width: 18 },
      { header: 'UPS', key: 'ups', width: 22 },
      { header: 'Remarks', key: 'remarks', width: 12 }
    ];

    // Header Row Styling (Dark Blue Theme)
    const headerRow = worksheet.getRow(1);
    headerRow.font = { name: 'Calibri', size: 8.5, bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1F4E79' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 28;

    // Formatter for System Unit Components Column (CPU, RAM, Motherboard, etc.)
    const formatSystemComponent = (part) => {
      if (!part) return '';
      const type = part.item_type ? `${part.item_type.toUpperCase()}: ` : '';
      const brandModel = `${part.brand || ''} ${part.model || ''}`.trim();
      const specs = part.specs ? ` [${part.specs}]` : '';
      const serial = part.serial_number ? ` (SN: ${part.serial_number})` : '';
      return `${type}${brandModel}${specs}${serial}`.trim();
    };

    // Formatter for Peripheral Columns (Monitor, Keyboard, Mouse, UPS)
    const formatPeripheral = (part) => {
      if (!part) return '';
      const brandModel = `${part.brand || ''} ${part.model || ''}`.trim();
      const specs = part.specs ? ` - ${part.specs}` : '';
      const serial = part.serial_number ? `\n(${part.serial_number})` : '';
      return `${brandModel}${specs}${serial}`.trim();
    };

    computers.forEach((c, compIndex) => {
      const parts = c.parts || [];

      // Core system components
      const systemTypes = ['cpu', 'ram', 'motherboard', 'ssd', 'hdd', 'case', 'casing', 'storage'];
      const systemParts = parts.filter(p => systemTypes.includes((p.item_type || '').toLowerCase()));
      const systemComponentsSummary = systemParts.map(formatSystemComponent).join('\n');

      // Peripherals
      const monitorParts = parts.filter(p => (p.item_type || '').toLowerCase() === 'monitor');
      const keyboardParts = parts.filter(p => (p.item_type || '').toLowerCase() === 'keyboard');
      const mouseParts = parts.filter(p => (p.item_type || '').toLowerCase() === 'mouse');
      const upsParts = parts.filter(p => (p.item_type || '').toLowerCase() === 'ups');

      const monitorText = monitorParts.map(formatPeripheral).join('\n');
      const keyboardText = keyboardParts.map(formatPeripheral).join('\n');
      const mouseText = mouseParts.map(formatPeripheral).join('\n');
      const upsText = upsParts.map(formatPeripheral).join('\n');

      const row = worksheet.addRow({
        no: compIndex + 1,
        code: c.property_code || '',
        name: c.property_name || '',
        location: c.location || '',
        department: c.department || '',
        drp1: c.drp1 || '',
        drp2: c.drp2 || '',
        system_components: systemComponentsSummary || '',
        monitor: monitorText,
        keyboard: keyboardText,
        mouse: mouseText,
        ups: upsText,
        remarks: ''
      });

      // Calculate dynamic row height to keep entries clean and clear
      const maxLines = Math.max(
        systemParts.length,
        monitorParts.length * 2,
        keyboardParts.length * 2,
        mouseParts.length * 2,
        upsParts.length * 2,
        1
      );
      row.height = Math.max(22, maxLines * 12);

      // Cell Borders and Text Alignment
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 7.5 };
        
        // System unit components (Column 8) left-aligned; others centered
        const isLeftAligned = colNumber === 8;
        cell.alignment = { 
          vertical: 'middle', 
          horizontal: isLeftAligned ? 'left' : 'center', 
          wrapText: true 
        };

        cell.border = {
          top: { style: 'thin', color: { argb: '000000' } },
          bottom: { style: 'thin', color: { argb: '000000' } },
          left: { style: 'thin', color: { argb: '000000' } },
          right: { style: 'thin', color: { argb: '000000' } }
        };
      });
    });

    let filename = 'inventory_report.xlsx';
    if (computers.length === 1 && computers[0].property_name) {
      const sanitizedName = computers[0].property_name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      filename = `${sanitizedName}_report.xlsx`;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export Error:', err);
    res.status(500).send('Export failed');
  }
});

/* --- INVENTORY / COMPUTERS ROUTES --- */
app.get('/api/inventory', async (req, res) => {
  const data = await Computer.find();
  res.json(data);
});

app.post('/api/computers', requireAdmin, async (req, res) => {
  const comp = new Computer(req.body);
  await comp.save();
  res.status(201).json(comp);
});

app.put('/api/computers/:id', requireAdmin, async (req, res) => {
  const comp = await Computer.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(comp);
});

app.delete('/api/computers/:id', requireAdmin, async (req, res) => {
  await Computer.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* --- PARTS / COMPONENTS ROUTES --- */
app.post('/api/components', requireAdmin, async (req, res) => {
  const { computer_id, ...partData } = req.body;
  const comp = await Computer.findById(computer_id);
  if (!comp) return res.status(404).json({ error: 'Computer not found' });

  comp.parts.push(partData);
  await comp.save();
  res.status(201).json(comp);
});

app.put('/api/components/:id', requireAdmin, async (req, res) => {
  const comp = await Computer.findOne({ 'parts._id': req.params.id });
  if (!comp) return res.status(404).json({ error: 'Part not found' });

  const part = comp.parts.id(req.params.id);
  Object.assign(part, req.body);
  await comp.save();
  res.json(part);
});

app.delete('/api/components/:id', requireAdmin, async (req, res) => {
  await Computer.updateOne(
    { 'parts._id': req.params.id },
    { $pull: { parts: { _id: req.params.id } } }
  );
  res.json({ success: true });
});

/* --- REPAIR LOGS ROUTES --- */
app.post('/api/repair-logs', requireAdmin, async (req, res) => {
  const { computer_id, ...logData } = req.body;
  const comp = await Computer.findById(computer_id);
  if (!comp) return res.status(404).json({ error: 'Computer not found' });

  comp.history.push(logData);
  await comp.save();
  res.status(201).json(comp);
});

app.put('/api/repair-logs/:id', requireAdmin, async (req, res) => {
  const comp = await Computer.findOne({ 'history._id': req.params.id });
  if (!comp) return res.status(404).json({ error: 'Repair log not found' });

  const log = comp.history.id(req.params.id);
  Object.assign(log, req.body);
  await comp.save();
  res.json(log);
});

app.delete('/api/repair-logs/:id', requireAdmin, async (req, res) => {
  await Computer.updateOne(
    { 'history._id': req.params.id },
    { $pull: { history: { _id: req.params.id } } }
  );
  res.json({ success: true });
});

/* --- TECHNICIANS ROUTES --- */
app.get('/api/technicians', async (req, res) => {
  const techs = await Technician.find();
  res.json(techs);
});

app.post('/api/technicians', requireAdmin, async (req, res) => {
  try {
    const tech = new Technician(req.body);
    await tech.save();
    res.status(201).json(tech);
  } catch (err) {
    res.status(400).json({ error: 'Technician already exists or invalid data' });
  }
});

app.delete('/api/technicians/:id', requireAdmin, async (req, res) => {
  await Technician.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// Wildcard route pointing directly to public/index.html
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));