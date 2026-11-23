# APANAH: The AI Back Office for Small Shops & MSMEs
**President's Innovation Fund Prototype Demonstration**  
*Founders: Arnav Ghatole & Arinjay Pawar (VIT Pune)*  
*Target Geography: Pune, Maharashtra (Pre-Seed Stage)*

---

## 1. Executive Summary & Problem-Solution Matrix

Small retail counters and quick-service food outlets (QSRs) in India currently run on paper notebooks or fragmented Excel sheets. Traditional billing software (Tally, Vyapar, POS machines) fails because:
* It costs **₹10,000 setup + ₹4,000/year**, yet requires manual keyboard entry for every item and supplier invoice.
* It does not calculate **culinary recipe Bill of Materials (BOM)**: Selling a plate of Medu Vada never updates on-hand Urad Dal or cooking oil stock.
* Shopkeepers have **no real-time profit visibility**, calculating margins only once a month when leakages have already occurred.

**Apanah** eliminates this manual burden:
> **"Every sale updates payments, stock and profit. No typing."**

---

## 2. Implemented Prototype Modules

### 📸 1. Zero-Typing Supplier Bill Ingestion (Multimodal Vision AI)
* **What it does**: Ingests supplier invoices, mandi delivery slips, and wholesale market bills via smartphone camera or upload.
* **Extraction Engine**: Uses Multimodal Document Vision (Gemini 1.5 Flash structured parser + regional Pune heuristic fallback) to automatically extract:
  - Vendor identity & invoice number
  - Line items, quantities, and units (kg, litre, pcs, pack)
  - Unit purchase rates & GST taxes
* **1-Tap Inventory Confirmation**: Automatically matches extracted items with the shop's stock ledger and calculates new blended weighted-average unit costs.

### ⚡ 2. High-Velocity POS with Dynamic Recipe BOM Depletion
* **What it does**: Counter interface built for rapid single-tap billing in high-rush conditions.
* **Culinary BOM State Machine**: Selling a dish automatically decomposes into its raw ingredients and deducts them atomically:
  - **1 Plate Medu Vada** $\rightarrow$ Deducts 50g Urad Dal + 15ml Cooking Oil.
  - **1 Puneri Misal Pav** $\rightarrow$ Deducts 120g Sprouted Matki + 35g Farsan + 2 Pav buns.
  - **1 Special Cutting Chai** $\rightarrow$ Deducts 80ml Milk + 7g Tea Leaves + 12g Sugar.
  - **Packaged Retail (Parle-G, Thums Up)** $\rightarrow$ 1-to-1 SKU decrement.
* **Live COGS Calculation**: Dynamically values consumed ingredients based on active supplier batch rates to calculate true gross profit for every transaction.

### 📊 3. Executive Real-Time Financial Dashboard
* Instantaneous telemetry on:
  - Today's Gross Sales & Average Order Value
  - True Cost of Goods Sold (COGS)
  - Net Operating Profit & Gross Margin %
  - Real-time stock valuation across all on-hand goods
  - Payment mode split (UPI QR vs. Cash vs. Card)
  - Active low-stock warnings when ingredients drop below safety thresholds

### ⚖️ 4. Weekly Stock Audit & Shrinkage Calibration
* Enables weekly physical weigh-ins of key high-turnover staples (oil, dal, milk).
* Compares physical count vs. theoretical system stock to isolate kitchen spillage, evaporation, or unrecorded waste.
* Calibrates the stock ledger and logs financial shrinkage impact in ₹.

### 💾 5. Native Indian Accounting Interoperability
* 1-Click export to **Tally Prime / ERP 9 XML (Day Book)** with debit/credit ledger mappings.
* 1-Click export to **Vyapar POS Sales CSV** and **Vyapar Purchases CSV**.

---

## 3. Quick Start & Execution Guide

### Prerequisites
* **Node.js**: v18.0.0 or higher (v24.x tested)
* **NPM**: v9.0.0 or higher

### Launch the Application
In your terminal, run:
```bash
npm start
```
Open your browser and navigate to:
```
http://localhost:3000
```

### Run Automated E2E Test Suite
To verify all 10 core subsystems (API health, BOM depletion, bill ingestion, P&L analytics, shrinkage audit, and Tally/Vyapar exporters):
```bash
node test/e2e.test.js
```

---

## 4. Evaluator Demonstration Walkthrough (5-Minute Script)

1. **Step 1: Check Current Stock**  
   Click the **"Stock & Recipes"** tab. Note that `Urad Dal (Premium)` has an initial stock of `18.5 kg`.
2. **Step 2: Make a Sale with Recipe BOM**  
   Click **"Counter POS"**. Tap **Medu Vada (Plate of 2)** twice, select **"UPI QR"**, and tap **"Complete Sale (Deduct Stock)"**.  
   *Observation*: The order chimes, displays a ₹100 revenue confirmation, and atomically deducts 100g of Urad Dal and 30ml of oil.
3. **Step 3: Zero-Typing Bill Ingestion**  
   Click the **"Bill Ingestion (OCR)"** tab. Under "Or Test With Real Pune Wholesale Invoices", click **"Gultekdi Market Yard Wholesale"** (or upload any supplier bill photo).  
   *Observation*: The AI extracts 25kg of Urad Dal @ ₹112/kg. Click **"Confirm & Add to Stock (1-Tap)"**.  
   Return to "Stock & Recipes" to see Urad Dal replenished to `43.4 kg`.
4. **Step 4: Inspect Executive Telemetry**  
   Click **"Executive P&L"**. View today's gross sales, real-time COGS, net profit margin, and payment mode split (UPI 100%).
5. **Step 5: Export to Tally & Vyapar**  
   Click **"Tally / Vyapar Export"**. Click **"Download Tally XML"** to inspect the generated XML Day Book ready for Tally Prime.

---

## 5. President's Innovation Fund Milestone Mapping

| Milestone Target | Delivery Status | Verification |
| :--- | :--- | :--- |
| **B2B Micro-SaaS Model** | ✅ Validated | ₹300-400/month pricing hypothesis model |
| **Multimodal Vision OCR** | ✅ Operational | Sub-second extraction from supplier invoices |
| **Recipe BOM Depletion** | ✅ Operational | Pre-calibrated Pune regional culinary templates |
| **Real-time Mobile P&L** | ✅ Operational | Live gross margin and payment analytics |
| **Tally / Vyapar Bridge** | ✅ Operational | XML & CSV daybook export pipelines |
