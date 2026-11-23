const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../database');
const { ocrService } = require('../services/ocrService');
const { bomService } = require('../services/bomService');
const { ledgerService } = require('../services/ledgerService');
const { auditService } = require('../services/auditService');
const { exportService } = require('../services/exportService');

const router = express.Router();

// Configure Multer storage for invoice uploads
const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const UPLOADS_DIR = isVercel ? path.join('/tmp', 'uploads') : path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch (e) {}
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `bill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// Health Check
router.get('/health', (req, res) => {
  res.json({
    status: "healthy",
    project: "Apanah AI Back Office",
    version: "1.0.0-prototype",
    timestamp: new Date().toISOString()
  });
});

// 1. Inventory & Raw Materials Endpoints
router.get('/inventory', (req, res) => {
  res.json({
    success: true,
    data: db.getInventory()
  });
});

router.post('/inventory', (req, res) => {
  try {
    const updated = db.addOrUpdateInventoryItem(req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 2. Menu & Recipe BOM Endpoints
router.get('/menu', (req, res) => {
  res.json({
    success: true,
    data: db.getMenu()
  });
});

router.post('/menu', (req, res) => {
  try {
    const updated = db.addOrUpdateMenuItem(req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 3. POS Order Execution & Simulation
router.post('/pos/order', (req, res) => {
  try {
    const order = bomService.processOrder(req.body);
    res.status(201).json({
      success: true,
      message: "Order placed and inventory depleted via recipe BOM successfully.",
      data: order
    });
  } catch (err) {
    console.error("[API] Order processing failure:", err);
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/pos/simulate', (req, res) => {
  try {
    const simulation = bomService.simulateOrder(req.body.items || []);
    res.json({ success: true, data: simulation });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 4. Zero-Typing Bill OCR & Ingestion
router.post('/bills/upload', upload.single('billImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No bill image uploaded." });
    }
    const parsedInvoice = await ocrService.parseInvoiceImage(req.file);
    res.json({
      success: true,
      message: "Supplier bill parsed via Multimodal Document AI.",
      data: parsedInvoice
    });
  } catch (err) {
    console.error("[API] Bill parsing failed:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper for rapid 1-click sample bill simulation during demo
router.post('/bills/parse-sample', async (req, res) => {
  try {
    const { sampleType = "kirana_oil" } = req.body;
    let mockFileName = "gultekdi_market_yard_kirana.jpg";
    if (sampleType === "dairy") mockFileName = "katraj_dairy_swargate.jpg";
    if (sampleType === "bakery") mockFileName = "modern_pune_bakery_pav.jpg";

    const parsedInvoice = await ocrService.parseInvoiceImage({ originalname: mockFileName });
    res.json({
      success: true,
      sampleType,
      data: parsedInvoice
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/bills/confirm', (req, res) => {
  try {
    const committed = ocrService.commitInvoice(req.body);
    res.json({
      success: true,
      message: "Bill confirmed. Inventory balances incremented & purchase recorded.",
      data: committed
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/bills/history', (req, res) => {
  res.json({
    success: true,
    data: db.getInvoices()
  });
});

// 5. Executive Real-Time Dashboard & Analytics
router.get('/analytics/dashboard', (req, res) => {
  try {
    const metrics = ledgerService.getDashboardMetrics();
    res.json({
      success: true,
      data: metrics
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Stock Count Audit & Shrinkage Calibration
router.post('/audit/reconcile', (req, res) => {
  try {
    const { auditEntries, auditor } = req.body;
    const summary = auditService.reconcilePhysicalCount(auditEntries, auditor);
    res.json({
      success: true,
      message: "Physical audit reconciled. Inventory updated and shrinkage calibrated.",
      data: summary
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/audit/history', (req, res) => {
  res.json({
    success: true,
    data: db.getAuditLogs()
  });
});

// 7. Accounting Interoperability & Exporters
router.get('/export/tally', (req, res) => {
  try {
    const xml = exportService.generateTallyXML();
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', 'attachment; filename="Apanah_Tally_DayBook.xml"');
    res.send(xml);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/export/vyapar-sales', (req, res) => {
  try {
    const csv = exportService.generateVyaparSalesCSV();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="Apanah_Vyapar_Sales.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/export/vyapar-purchases', (req, res) => {
  try {
    const csv = exportService.generateVyaparPurchaseCSV();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="Apanah_Vyapar_Purchases.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Demo Reset
router.post('/seed/reset', (req, res) => {
  const fresh = db.resetToDefault();
  res.json({
    success: true,
    message: "Apanah database reset to default Pune regional pilot state.",
    data: fresh
  });
});

module.exports = router;
