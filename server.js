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

/* --- EXPORT EXCEL (.XLSX) WITH AUTOMATIC AUTO-FIT & CLEAN LAYOUT --- */
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

    // Page setup optimized to fit 5-10 records per printed landscape page
    worksheet.pageSetup = {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.3, bottom: 0.3, header: 0, footer: 0 }
    };

    // Adjusted column widths to fit content and avoid overflow
    worksheet.columns = [
      { header: 'No.', key: 'no', width: 5 },
      { header: 'Computer Code', key: 'code', width: 16 },
      { header: 'Computer Name', key: 'name', width: 14 },
      { header: 'Location', key: 'location', width: 18 },
      { header: 'Department', key: 'department', width: 10 },
      { header: 'DRP1', key: 'drp1', width: 14 },
      { header: 'DRP2', key: 'drp2', width: 14 },
      { header: 'Part Type', key: 'part_type', width: 13 },
      { header: 'Part Brand/Model', key: 'part_model', width: 35 } // Expanded width
    ];

    // Header Styling
    const headerRow = worksheet.getRow(1);
    headerRow.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1F4E79' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 20;

    let currentRowIdx = 2; // Track starting row index for merging

    computers.forEach((c, compIndex) => {
      const parts = c.parts || [];
      const rowCount = parts.length > 0 ? parts.length : 1;
      const startRow = currentRowIdx;

      for (let i = 0; i < rowCount; i++) {
        const p = parts[i] || {};
        const partModelStr = `${p.brand || ''} ${p.model || ''} ${p.serial_number ? '(' + p.serial_number + ')' : ''}`.trim();

        const row = worksheet.addRow({
          no: compIndex + 1,
          code: c.property_code || '',
          name: c.property_name || '',
          location: c.location || '',
          department: c.department || '',
          drp1: c.drp1 || '',
          drp2: c.drp2 || '',
          part_type: p.item_type || '',
          part_model: partModelStr
        });

        // Dynamic row height adjustment prevents text clipping on multi-line values
        row.height = partModelStr.length > 30 ? 26 : 18;

        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.font = { name: 'Calibri', size: 8 };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          cell.border = {
            top: { style: 'thin', color: { argb: '000000' } },
            bottom: { style: 'thin', color: { argb: '000000' } },
            left: { style: 'thin', color: { argb: '000000' } },
            right: { style: 'thin', color: { argb: '000000' } }
          };
        });

        currentRowIdx++;
      }

      const endRow = currentRowIdx - 1;

      // Vertically merge computer metadata cells across all part rows
      if (startRow < endRow) {
        worksheet.mergeCells(`A${startRow}:A${endRow}`); // No.
        worksheet.mergeCells(`B${startRow}:B${endRow}`); // Code
        worksheet.mergeCells(`C${startRow}:C${endRow}`); // Name
        worksheet.mergeCells(`D${startRow}:D${endRow}`); // Location
        worksheet.mergeCells(`E${startRow}:E${endRow}`); // Department
        worksheet.mergeCells(`F${startRow}:F${endRow}`); // DRP1
        worksheet.mergeCells(`G${startRow}:G${endRow}`); // DRP2
      }
    });

    // Dynamic Filename
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