const { db } = require('../database');

/**
 * Dynamic Bill of Materials (BOM) & Recipe Depletion Engine
 * Executes atomic stock deductions across raw materials for finished culinary dishes
 * and calculates precise Cost of Goods Sold (COGS) on every transaction.
 */
class BOMService {
  /**
   * Process a Point-of-Sale customer order:
   * 1. Resolves recipe Bill of Materials for each dish/item
   * 2. Atomically deducts raw material quantities from inventory
   * 3. Calculates dynamic COGS based on batch unit costs
   * 4. Updates real-time profit margins
   * 5. Flags low-stock ingredient alerts
   * 
   * @param {Object} orderPayload - { items: [{ menuItemId, quantity }], paymentMode: 'UPI'|'Cash'|'Card' }
   */
  processOrder(orderPayload) {
    const { items, paymentMode = "UPI", customerNote = "" } = orderPayload;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error("Order items array cannot be empty.");
    }

    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    let totalGrossRevenue = 0;
    let totalOrderCOGS = 0;
    const processedItems = [];
    const depletions = [];
    const lowStockAlerts = [];

    // Phase 1: Verify and compute deductions
    for (const item of items) {
      const menuItem = db.getMenuItem(item.menuItemId);
      if (!menuItem) {
        throw new Error(`Menu item not found: ${item.menuItemId}`);
      }

      const qty = parseInt(item.quantity, 10) || 1;
      const itemSubtotal = menuItem.price * qty;
      totalGrossRevenue += itemSubtotal;

      let itemCalculatedCOGS = 0;
      const itemRecipeDepletions = [];

      // Loop through recipe Bill of Materials (BOM)
      if (menuItem.recipe && Array.isArray(menuItem.recipe)) {
        for (const ingredient of menuItem.recipe) {
          const rawMaterial = db.getInventoryItem(ingredient.materialId);
          if (!rawMaterial) {
            console.warn(`[BOMService] Raw ingredient ${ingredient.materialId} not found in inventory!`);
            continue;
          }

          const requiredQty = parseFloat((ingredient.quantity * qty).toFixed(4));
          const ingredientCost = parseFloat((requiredQty * (rawMaterial.costPerUnit || 0)).toFixed(2));
          itemCalculatedCOGS += ingredientCost;

          // Record depletion step
          itemRecipeDepletions.push({
            materialId: rawMaterial.id,
            materialName: rawMaterial.name,
            unit: rawMaterial.unit,
            deductedQty: requiredQty,
            ingredientCost,
            priorStock: rawMaterial.currentStock
          });

          // Perform atomic deduction
          rawMaterial.currentStock = Math.max(0, parseFloat((rawMaterial.currentStock - requiredQty).toFixed(3)));

          // Check low stock threshold
          if (rawMaterial.currentStock <= rawMaterial.minThreshold) {
            lowStockAlerts.push({
              materialId: rawMaterial.id,
              materialName: rawMaterial.name,
              currentStock: rawMaterial.currentStock,
              unit: rawMaterial.unit,
              minThreshold: rawMaterial.minThreshold
            });
          }
        }
      }

      totalOrderCOGS += itemCalculatedCOGS;
      const grossMargin = parseFloat((itemSubtotal - itemCalculatedCOGS).toFixed(2));
      const marginPercentage = itemSubtotal > 0 ? parseFloat(((grossMargin / itemSubtotal) * 100).toFixed(1)) : 0;

      processedItems.push({
        menuItemId: menuItem.id,
        name: menuItem.name,
        category: menuItem.category,
        quantity: qty,
        unitPrice: menuItem.price,
        subtotal: itemSubtotal,
        cogs: parseFloat(itemCalculatedCOGS.toFixed(2)),
        grossMargin,
        marginPercentage,
        recipeDepletions: itemRecipeDepletions
      });

      depletions.push(...itemRecipeDepletions);
    }

    const netGrossProfit = parseFloat((totalGrossRevenue - totalOrderCOGS).toFixed(2));
    const overallMarginPercent = totalGrossRevenue > 0 ? parseFloat(((netGrossProfit / totalGrossRevenue) * 100).toFixed(1)) : 0;

    const completedOrder = {
      id: orderId,
      timestamp: new Date().toISOString(),
      displayTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      paymentMode: paymentMode.toUpperCase(), // UPI, CASH, CARD
      totalRevenue: totalGrossRevenue,
      totalCOGS: parseFloat(totalOrderCOGS.toFixed(2)),
      grossProfit: netGrossProfit,
      marginPercent: overallMarginPercent,
      items: processedItems,
      allDepletions: depletions,
      lowStockAlerts,
      customerNote
    };

    // Save order into database and persist
    db.addOrder(completedOrder);
    db.save();

    console.log(`[BOMService] Order ${orderId} processed: ₹${totalGrossRevenue} | COGS: ₹${totalOrderCOGS.toFixed(2)} | Profit: ₹${netGrossProfit}`);

    return completedOrder;
  }

  /**
   * Pre-flight simulation of an order to preview stock deductions and margins without committing
   */
  simulateOrder(items) {
    let totalGrossRevenue = 0;
    let totalCOGS = 0;
    const recipePreview = [];

    for (const item of items) {
      const menuItem = db.getMenuItem(item.menuItemId);
      if (!menuItem) continue;

      const qty = parseInt(item.quantity, 10) || 1;
      const subtotal = menuItem.price * qty;
      totalGrossRevenue += subtotal;

      let itemCOGS = 0;
      if (menuItem.recipe) {
        for (const ingredient of menuItem.recipe) {
          const raw = db.getInventoryItem(ingredient.materialId);
          if (raw) {
            const req = ingredient.quantity * qty;
            itemCOGS += req * raw.costPerUnit;
            recipePreview.push({
              dish: menuItem.name,
              rawName: raw.name,
              deduction: `${req.toFixed(3)} ${raw.unit}`,
              cost: `₹${(req * raw.costPerUnit).toFixed(2)}`
            });
          }
        }
      }
      totalCOGS += itemCOGS;
    }

    return {
      revenue: totalGrossRevenue,
      cogs: parseFloat(totalCOGS.toFixed(2)),
      profit: parseFloat((totalGrossRevenue - totalCOGS).toFixed(2)),
      margin: totalGrossRevenue > 0 ? parseFloat((((totalGrossRevenue - totalCOGS) / totalGrossRevenue) * 100).toFixed(1)) : 0,
      recipePreview
    };
  }
}

const bomService = new BOMService();

module.exports = {
  bomService
};
