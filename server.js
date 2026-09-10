const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB Atlas using the Render Environment Variable
const MONGODB_URI = process.env.DATABASE_URL;

if (!MONGODB_URI) {
  console.error('CRITICAL ERROR: DATABASE_URL environment variable is missing!');
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Successfully connected to MongoDB Atlas!'))
  .catch(err => console.error('MongoDB Atlas connection error:', err));

/* MONGODB SCHEMAS & MODELS */

// Sub-document schema for computer parts
const PartSchema = new mongoose.Schema({
  item_type: String,
  brand: String,
  model: String,
  specs: String,
  serial_number: String,
  date_purchased: String
});

// Sub-document schema for repair history logs
const RepairSchema = new mongoose.Schema({
  log_date: String,
  item: String,
  description: String,
  remarks: String
});

// Main Workstation / Computer Schema
const ComputerSchema = new mongoose.Schema({
  property_name: String,
  property_code: { type: String, unique: true, required: true },
  location: String,
  department: String,
  drp1: String,
  drp2: String,
  parts: [PartSchema],
  history: [RepairSchema]
});

// Technician Schema
const TechnicianSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true }
});

const Computer = mongoose.model('Computer', ComputerSchema);
const Technician = mongoose.model('Technician', TechnicianSchema);

// Initial default seed for technicians
async function seedTechnicians() {
  try {
    const count = await Technician.countDocuments();
    if (count === 0) {
      const defaultTechs = ['Joram', 'Reinner', 'Edrian', 'Riel'];
      await Technician.insertMany(defaultTechs.map(name => ({ name })));
      console.log('Default technicians seeded successfully.');
    }
  } catch (err) {
    console.error('Error seeding default technicians:', err);
  }
}
seedTechnicians();

/* REST API ENDPOINTS */

// Get all computers with populated parts and history
app.get('/api/inventory', async (req, res) => {
  try {
    const computers = await Computer.find().sort({ property_name: 1 });
    
    // Format _id fields to string 'id' for frontend compatibility
    const formatted = computers.map(comp => {
      const obj = comp.toObject();
      obj.id = obj._id.toString();
      obj.parts = (obj.parts || []).map(p => ({ ...p, id: p._id.toString() }));
      obj.history = (obj.history || []).map(h => ({ ...h, id: h._id.toString() }));
      return obj;
    });
    
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new Computer / Workstation
app.post('/api/computers', async (req, res) => {
  try {
    const comp = new Computer(req.body);
    await comp.save();
    res.json({ id: comp._id.toString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Computer details
app.put('/api/computers/:id', async (req, res) => {
  try {
    await Computer.findByIdAndUpdate(req.params.id, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Computer
app.delete('/api/computers/:id', async (req, res) => {
  try {
    await Computer.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Component / Part to a Computer
app.post('/api/components', async (req, res) => {
  const { computer_id, ...partData } = req.body;
  try {
    const comp = await Computer.findById(computer_id);
    if (!comp) return res.status(404).json({ error: 'Computer not found' });
    
    comp.parts.push(partData);
    await comp.save();
    const newPart = comp.parts[comp.parts.length - 1];
    res.json({ id: newPart._id.toString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Component / Part
app.put('/api/components/:id', async (req, res) => {
  try {
    const comp = await Computer.findOne({ "parts._id": req.params.id });
    if (!comp) return res.status(404).json({ error: 'Part not found' });
    
    const part = comp.parts.id(req.params.id);
    Object.assign(part, req.body);
    await comp.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Component / Part
app.delete('/api/components/:id', async (req, res) => {
  try {
    await Computer.updateOne({}, { $pull: { parts: { _id: req.params.id } } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Repair Log to a Computer
app.post('/api/repair-logs', async (req, res) => {
  const { computer_id, ...logData } = req.body;
  try {
    const comp = await Computer.findById(computer_id);
    if (!comp) return res.status(404).json({ error: 'Computer not found' });
    
    comp.history.push(logData);
    await comp.save();
    const newLog = comp.history[comp.history.length - 1];
    res.json({ id: newLog._id.toString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Repair Log
app.put('/api/repair-logs/:id', async (req, res) => {
  try {
    const comp = await Computer.findOne({ "history._id": req.params.id });
    if (!comp) return res.status(404).json({ error: 'Repair log not found' });
    
    const log = comp.history.id(req.params.id);
    Object.assign(log, req.body);
    await comp.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Repair Log
app.delete('/api/repair-logs/:id', async (req, res) => {
  try {
    await Computer.updateOne({}, { $pull: { history: { _id: req.params.id } } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Technicians
app.get('/api/technicians', async (req, res) => {
  try {
    const techs = await Technician.find().sort({ name: 1 });
    res.json(techs.map(t => ({ id: t._id.toString(), name: t.name })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Technician
app.post('/api/technicians', async (req, res) => {
  try {
    const tech = new Technician({ name: req.body.name });
    await tech.save();
    res.json({ id: tech._id.toString(), name: tech.name });
  } catch (err) {
    res.status(400).json({ error: 'Technician already exists.' });
  }
});

// Delete Technician
app.delete('/api/technicians/:id', async (req, res) => {
  try {
    await Technician.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});