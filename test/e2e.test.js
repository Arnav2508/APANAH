const assert = require('assert');
const { app, server } = require('../server');
const { db } = require('../src/database');

async function runTests() {
  console.log("=================================================");
  console.log("  APANAH: PROTOTYPE END-TO-END VALIDATION SUITE  ");
  console.log("  President's Innovation Fund Technical Assurance ");
  console.log("=================================================\n");

  if (!server.listening) {
    await new Promise(resolve => {
      if (server.listening) return resolve();
      server.once('listening', resolve);
      setTimeout(resolve, 500);
    });
  }
  const address = server.address();
  const port = address && typeof address === 'object' ? address.port : 3000;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Test 1: Health Check
    console.log("[Test 1] Testing /api/health endpoint...");
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const health = await healthRes.json();
    assert.strictEqual(health.status, "healthy", "Health status must be healthy");
    console.log("  ✓ Health check passed.");

    // Test 2: Database Reset & Seed Verification
    console.log("[Test 2] Resetting database to pristine state...");
    const resetRes = await fetch(`${baseUrl}/api/seed/reset`, { method: "POST" });
    const resetData = await resetRes.json();
    assert.strictEqual(resetData.success, true);
    console.log("  ✓ Database reset verified.");

    // Test 3: Fetch Inventory & Verify Raw Materials
    console.log("[Test 3] Verifying initial inventory & Pune templates...");
    const invRes = await fetch(`${baseUrl}/api/inventory`);
    const invData = await invRes.json();
    assert.ok(invData.data.length >= 10, "Should have at least 10 inventory items");
    const uradDal = invData.data.find(i => i.id === "raw_urad_dal");
    assert.ok(uradDal, "Urad Dal must exist in initial stock");
    const initialDalStock = uradDal.currentStock;
    console.log(`  ✓ Inventory verified. Initial Urad Dal stock: ${initialDalStock} kg.`);

    // Test 4: Fetch Menu & Verify Recipe BOM
    console.log("[Test 4] Verifying culinary menu & Recipe BOM...");
    const menuRes = await fetch(`${baseUrl}/api/menu`);
    const menuData = await menuRes.json();
    const meduVada = menuData.data.find(m => m.id === "menu_medu_vada");
    assert.ok(meduVada, "Medu Vada must exist in menu");
    assert.ok(meduVada.recipe.length > 0, "Medu Vada must have recipe BOM ingredients");
    console.log(`  ✓ Menu verified. Medu Vada has ${meduVada.recipe.length} recipe ingredients.`);

    // Test 5: Process POS Order & Verify Atomic Recipe BOM Stock Deduction
    console.log("[Test 5] Executing POS Order: 2 plates of Medu Vada + 1 Cutting Chai (UPI)...");
    const orderPayload = {
      items: [
        { menuItemId: "menu_medu_vada", quantity: 2 }, // 2 * 0.05 = 0.10 kg Urad Dal deducted
        { menuItemId: "menu_cutting_chai", quantity: 1 } // 0.08L milk deducted
      ],
      paymentMode: "UPI"
    };

    const orderRes = await fetch(`${baseUrl}/api/pos/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderPayload)
    });
    const orderData = await orderRes.json();
    assert.strictEqual(orderData.success, true);
    assert.strictEqual(orderData.data.totalRevenue, 115.0); // 50*2 + 15 = 115
    assert.ok(orderData.data.totalCOGS > 0, "COGS must be computed");
    assert.ok(orderData.data.grossProfit > 0, "Gross profit must be positive");
    console.log(`  ✓ POS Order executed: Revenue ₹${orderData.data.totalRevenue} | COGS ₹${orderData.data.totalCOGS} | Profit ₹${orderData.data.grossProfit}`);

    // Verify inventory decrement
    const postOrderInvRes = await fetch(`${baseUrl}/api/inventory`);
    const postOrderInv = await postOrderInvRes.json();
    const postOrderDal = postOrderInv.data.find(i => i.id === "raw_urad_dal");
    const expectedDalStock = parseFloat((initialDalStock - 0.1).toFixed(3));
    assert.strictEqual(postOrderDal.currentStock, expectedDalStock, "Urad Dal stock must be depleted by exactly 100g");
    console.log(`  ✓ Atomic recipe depletion verified: Urad Dal reduced from ${initialDalStock}kg to ${postOrderDal.currentStock}kg.`);

    // Test 6: Zero-Typing Bill Ingestion & 1-Tap Stock Confirmation
    console.log("[Test 6] Testing Multimodal Bill Ingestion (Sample Pune Wholesale Bill)...");
    const billSampleRes = await fetch(`${baseUrl}/api/bills/parse-sample`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sampleType: "kirana_oil" })
    });
    const billSampleData = await billSampleRes.json();
    assert.strictEqual(billSampleData.success, true);
    assert.ok(billSampleData.data.items.length > 0, "Should extract line items from bill");
    console.log(`  ✓ Bill extracted: ${billSampleData.data.vendorName} | ${billSampleData.data.items.length} line items.`);

    // Confirm Bill into Stock
    console.log("[Test 7] Confirming approved bill into stock ledger...");
    const confirmBillRes = await fetch(`${baseUrl}/api/bills/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(billSampleData.data)
    });
    const confirmBillData = await confirmBillRes.json();
    assert.strictEqual(confirmBillData.success, true);
    
    // Verify replenished inventory
    const postBillInvRes = await fetch(`${baseUrl}/api/inventory`);
    const postBillInv = await postBillInvRes.json();
    const replenishedDal = postBillInv.data.find(i => i.id === "raw_urad_dal");
    assert.ok(replenishedDal.currentStock > postOrderDal.currentStock, "Stock must be incremented by incoming bill");
    console.log(`  ✓ Stock increment verified: Urad Dal stock replenished to ${replenishedDal.currentStock} kg.`);

    // Test 8: Real-Time Executive Dashboard Metrics
    console.log("[Test 8] Querying real-time executive dashboard...");
    const dashRes = await fetch(`${baseUrl}/api/analytics/dashboard`);
    const dashData = await dashRes.json();
    assert.strictEqual(dashData.success, true);
    assert.strictEqual(dashData.data.overview.totalOrdersCount, 1);
    assert.strictEqual(dashData.data.paymentBreakdown.UPI.count, 1);
    console.log(`  ✓ Dashboard verified: Total Sales ₹${dashData.data.overview.totalRevenue} | Net Margin ${dashData.data.overview.netMarginPercent}% | UPI 100%.`);

    // Test 9: Weekly Physical Count Audit & Shrinkage Calibration
    console.log("[Test 9] Performing weekly physical stock count audit...");
    const auditPayload = {
      auditEntries: [
        { inventoryId: "raw_urad_dal", countedStock: replenishedDal.currentStock - 0.5, notes: "Cooking spillage" }
      ],
      auditor: "Shopkeeper Arun"
    };
    const auditRes = await fetch(`${baseUrl}/api/audit/reconcile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(auditPayload)
    });
    const auditData = await auditRes.json();
    assert.strictEqual(auditData.success, true);
    assert.ok(auditData.data.totalShrinkageLoss > 0, "Shrinkage loss must be calculated");
    console.log(`  ✓ Physical audit reconciled: Shrinkage loss ₹${auditData.data.totalShrinkageLoss} isolated and stock calibrated.`);

    // Test 10: Tally Prime XML & Vyapar CSV Generation
    console.log("[Test 10] Testing Tally Prime XML & Vyapar CSV Exporters...");
    const tallyRes = await fetch(`${baseUrl}/api/export/tally`);
    const tallyXml = await tallyRes.text();
    assert.ok(tallyXml.includes("<ENVELOPE>"), "Tally export must contain valid XML Envelope");
    assert.ok(tallyXml.includes("<VOUCHER"), "Tally export must contain sales vouchers");
    console.log("  ✓ Tally Prime XML Day Book verified.");

    const vyaparRes = await fetch(`${baseUrl}/api/export/vyapar-sales`);
    const vyaparCsv = await vyaparRes.text();
    assert.ok(vyaparCsv.includes("Invoice No,Party Name"), "Vyapar CSV must contain proper headers");
    console.log("  ✓ Vyapar Sales CSV verified.");

    console.log("\n=================================================");
    console.log("  ALL 10 VERIFICATION SUITES PASSED FLAWLESSLY!   ");
    console.log("=================================================");

  } catch (err) {
    console.error("Test failed with error:", err);
    process.exit(1);
  } finally {
    server.close();
    process.exit(0);
  }
}

runTests();
