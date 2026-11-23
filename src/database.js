const fs = require('fs');
const path = require('path');

const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const DATA_DIR = isVercel ? '/tmp' : path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'apanah_store.json');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    // Read-only or existing
  }
}

// Initial default state with rich Pune retail and QSR food data
const DEFAULT_STATE = {
  merchant: {
    id: "merchant_pune_001",
    name: "Apanah Demo - Shree Ganesh Fast Food & Kirana",
    owner: "Arnav Ghatole & Arinjay Pawar",
    location: "Kothrud / Swargate, Pune",
    type: "Hybrid Food & Retail MSME",
    currency: "INR",
    symbol: "₹"
  },
  // Raw materials and direct inventory items
  inventory: [
    { id: "raw_urad_dal", name: "Urad Dal (Premium)", category: "Grains & Pulses", type: "raw_material", currentStock: 18.5, unit: "kg", costPerUnit: 115.0, minThreshold: 5.0, supplier: "Gultekdi Market Yard Wholesalers" },
    { id: "raw_rice_idli", name: "Kolam Idli Rice", category: "Grains & Pulses", type: "raw_material", currentStock: 24.0, unit: "kg", costPerUnit: 48.0, minThreshold: 8.0, supplier: "Gultekdi Market Yard Wholesalers" },
    { id: "raw_cooking_oil", name: "Fortune Sunflower Oil", category: "Oils & Ghee", type: "raw_material", currentStock: 14.2, unit: "litre", costPerUnit: 135.0, minThreshold: 4.0, supplier: "Mahalaxmi Traders, Swargate" },
    { id: "raw_amul_milk", name: "Amul Taaza Milk", category: "Dairy", type: "raw_material", currentStock: 12.0, unit: "litre", costPerUnit: 54.0, minThreshold: 3.0, supplier: "Katraj Dairy Route Agent" },
    { id: "raw_matki_sprouts", name: "Sprouted Matki (Moath)", category: "Fresh Produce", type: "raw_material", currentStock: 9.0, unit: "kg", costPerUnit: 70.0, minThreshold: 3.0, supplier: "Gultekdi Mandi" },
    { id: "raw_poha", name: "Jad Poha (Thick)", category: "Grains & Pulses", type: "raw_material", currentStock: 15.0, unit: "kg", costPerUnit: 44.0, minThreshold: 5.0, supplier: "Gultekdi Market Yard Wholesalers" },
    { id: "raw_tea_leaves", name: "Wagh Bakri CTC Tea", category: "Beverages", type: "raw_material", currentStock: 4.5, unit: "kg", costPerUnit: 420.0, minThreshold: 1.5, supplier: "Poona Tea Depot" },
    { id: "raw_sugar", name: "Refined Sugar (M30)", category: "Pantry", type: "raw_material", currentStock: 22.0, unit: "kg", costPerUnit: 42.0, minThreshold: 5.0, supplier: "Gultekdi Market Yard Wholesalers" },
    { id: "raw_potatoes", name: "Pune Special Potatoes", category: "Fresh Produce", type: "raw_material", currentStock: 30.0, unit: "kg", costPerUnit: 28.0, minThreshold: 8.0, supplier: "Gultekdi Mandi" },
    { id: "raw_pav_buns", name: "Fresh Bakery Pav", category: "Bakery", type: "raw_material", currentStock: 80.0, unit: "pcs", costPerUnit: 2.5, minThreshold: 20.0, supplier: "Modern Pune Bakery" },
    { id: "raw_farsan", name: "Kolhapuri Kat Farsan", category: "Pantry", type: "raw_material", currentStock: 6.5, unit: "kg", costPerUnit: 140.0, minThreshold: 2.0, supplier: "Laxmi Farsan, Budhwar Peth" },
    
    // Direct Retail SKUs
    { id: "sku_parle_g", name: "Parle-G Gold 100g", category: "Packaged Retail", type: "retail_sku", currentStock: 45.0, unit: "pack", costPerUnit: 8.5, sellingPrice: 10.0, minThreshold: 10.0, supplier: "Parle Agency Pune" },
    { id: "sku_amul_butter", name: "Amul Butter 100g", category: "Packaged Retail", type: "retail_sku", currentStock: 18.0, unit: "pack", costPerUnit: 52.0, sellingPrice: 58.0, minThreshold: 5.0, supplier: "Katraj Dairy Route Agent" },
    { id: "sku_thums_up", name: "Thums Up 250ml Bottle", category: "Packaged Retail", type: "retail_sku", currentStock: 32.0, unit: "bottle", costPerUnit: 16.0, sellingPrice: 20.0, minThreshold: 8.0, supplier: "Hindustan Coca-Cola Depot" }
  ],
  // Menu items sold at POS with recipe Bill of Materials (BOM)
  menu: [
    {
      id: "menu_medu_vada",
      name: "Medu Vada (Plate of 2)",
      category: "Breakfast & Snacks",
      price: 50.0,
      description: "Crispy lentil fritters served with hot sambar and coconut chutney",
      recipe: [
        { materialId: "raw_urad_dal", quantity: 0.05, unit: "kg" }, // 50g per plate
        { materialId: "raw_cooking_oil", quantity: 0.015, unit: "litre" } // 15ml oil absorbed
      ]
    },
    {
      id: "menu_misal_pav",
      name: "Puneri Misal Pav (Special)",
      category: "Snacks & Meals",
      price: 80.0,
      description: "Fiery sprouted matki curry topped with farsan, served with 2 fresh pavs",
      recipe: [
        { materialId: "raw_matki_sprouts", quantity: 0.12, unit: "kg" }, // 120g matki
        { materialId: "raw_farsan", quantity: 0.035, unit: "kg" }, // 35g farsan
        { materialId: "raw_pav_buns", quantity: 2.0, unit: "pcs" }, // 2 pavs
        { materialId: "raw_cooking_oil", quantity: 0.015, unit: "litre" }
      ]
    },
    {
      id: "menu_kanda_poha",
      name: "Kanda Poha (Special)",
      category: "Breakfast & Snacks",
      price: 35.0,
      description: "Flattened rice cooked with onions, mustard, green chilies and peanuts",
      recipe: [
        { materialId: "raw_poha", quantity: 0.075, unit: "kg" }, // 75g poha
        { materialId: "raw_cooking_oil", quantity: 0.01, unit: "litre" }
      ]
    },
    {
      id: "menu_masala_dosa",
      name: "Butter Masala Dosa",
      category: "Breakfast & Snacks",
      price: 70.0,
      description: "Crispy fermented crepe with potato masala and dollop of butter",
      recipe: [
        { materialId: "raw_rice_idli", quantity: 0.05, unit: "kg" },
        { materialId: "raw_urad_dal", quantity: 0.02, unit: "kg" },
        { materialId: "raw_potatoes", quantity: 0.08, unit: "kg" },
        { materialId: "raw_cooking_oil", quantity: 0.01, unit: "litre" }
      ]
    },
    {
      id: "menu_cutting_chai",
      name: "Special Cutting Chai",
      category: "Beverages",
      price: 15.0,
      description: "Cardamom & ginger infused strong Pune cutting tea",
      recipe: [
        { materialId: "raw_amul_milk", quantity: 0.08, unit: "litre" }, // 80ml milk
        { materialId: "raw_tea_leaves", quantity: 0.007, unit: "kg" }, // 7g tea leaves
        { materialId: "raw_sugar", quantity: 0.012, unit: "kg" } // 12g sugar
      ]
    },
    {
      id: "menu_filter_coffee",
      name: "Hot Filter Coffee",
      category: "Beverages",
      price: 25.0,
      description: "Authentic South Indian chicory coffee froth",
      recipe: [
        { materialId: "raw_amul_milk", quantity: 0.12, unit: "litre" },
        { materialId: "raw_sugar", quantity: 0.015, unit: "kg" }
      ]
    },
    // Direct retail menu entries
    {
      id: "menu_parle_g",
      name: "Parle-G Gold 100g",
      category: "Packaged Retail",
      price: 10.0,
      description: "Direct Retail SKU",
      recipe: [
        { materialId: "sku_parle_g", quantity: 1.0, unit: "pack" }
      ]
    },
    {
      id: "menu_thums_up",
      name: "Thums Up 250ml Bottle",
      category: "Packaged Retail",
      price: 20.0,
      description: "Chilled soft drink",
      recipe: [
        { materialId: "sku_thums_up", quantity: 1.0, unit: "bottle" }
      ]
    }
  ],
  // Recorded sales orders with atomic BOM depletion logs
  orders: [],
  // Processed supplier bills (photo OCR)
  invoices: [],
  // Reconciliation logs (shrinkage, wastage adjustments)
  auditLogs: []
};

class Database {
  constructor() {
    this.state = this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error("[Database] Error reading database file, using defaults:", err.message);
    }
    this.save(DEFAULT_STATE);
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  save(data = this.state) {
    try {
      const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
      this.state = data;
      return true;
    } catch (err) {
      console.error("[Database] Error persisting state to file:", err.message);
      return false;
    }
  }

  resetToDefault() {
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this.save(this.state);
    return this.state;
  }

  // Inventory queries & mutations
  getInventory() {
    return this.state.inventory;
  }

  getInventoryItem(id) {
    return this.state.inventory.find(i => i.id === id);
  }

  updateInventoryStock(id, deltaQuantity, reason = "adjustment") {
    const item = this.getInventoryItem(id);
    if (!item) return null;
    item.currentStock = Math.max(0, parseFloat((item.currentStock + deltaQuantity).toFixed(3)));
    this.save();
    return item;
  }

  addOrUpdateInventoryItem(itemData) {
    const existingIndex = this.state.inventory.findIndex(i => i.id === itemData.id || i.name.toLowerCase() === itemData.name.toLowerCase());
    if (existingIndex >= 0) {
      this.state.inventory[existingIndex] = { ...this.state.inventory[existingIndex], ...itemData };
    } else {
      this.state.inventory.push({
        id: itemData.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ...itemData
      });
    }
    this.save();
    return this.state.inventory;
  }

  // Menu queries & mutations
  getMenu() {
    return this.state.menu;
  }

  getMenuItem(id) {
    return this.state.menu.find(m => m.id === id);
  }

  addOrUpdateMenuItem(menuItem) {
    const index = this.state.menu.findIndex(m => m.id === menuItem.id);
    if (index >= 0) {
      this.state.menu[index] = { ...this.state.menu[index], ...menuItem };
    } else {
      this.state.menu.push({
        id: menuItem.id || `menu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ...menuItem
      });
    }
    this.save();
    return this.state.menu;
  }

  // Orders
  getOrders() {
    return this.state.orders;
  }

  addOrder(order) {
    this.state.orders.unshift(order);
    this.save();
    return order;
  }

  // Invoices (Supplier Bills)
  getInvoices() {
    return this.state.invoices;
  }

  addInvoice(invoice) {
    this.state.invoices.unshift(invoice);
    this.save();
    return invoice;
  }

  // Audits & Shrinkage
  getAuditLogs() {
    return this.state.auditLogs;
  }

  addAuditLog(log) {
    this.state.auditLogs.unshift(log);
    this.save();
    return log;
  }
}

const db = new Database();

module.exports = {
  db,
  DEFAULT_STATE
};
