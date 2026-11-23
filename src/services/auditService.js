const { db } = require('../database');

/**
 * Physical Stock Audit & Shrinkage Calibration Service
 * Enables shopkeepers to perform weekly physical counts, isolate kitchen spillage,
 * theft, or unrecorded waste, and reconcile inventory balances.
 */
class AuditService {
  /**
   * Reconciles physical count entries against theoretical book stock
   * @param {Array} auditEntries - [{ inventoryId, countedStock, notes }]
   * @returns {Object} Reconciliation summary with shrinkage financial impact
   */
  reconcilePhysicalCount(auditEntries, auditor = "Shop Owner") {
    if (!auditEntries || !Array.isArray(auditEntries) || auditEntries.length === 0) {
      throw new Error("Audit entries cannot be empty.");
    }

    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const timestamp = new Date().toISOString();
    let totalShrinkageLoss = 0;
    let totalSurplusGain = 0;
    const itemVariances = [];

    for (const entry of auditEntries) {
      const item = db.getInventoryItem(entry.inventoryId);
      if (!item) continue;

      const counted = parseFloat(parseFloat(entry.countedStock || 0).toFixed(3));
      const theoretical = item.currentStock;
      const variance = parseFloat((counted - theoretical).toFixed(3));
      const varianceValue = parseFloat((variance * item.costPerUnit).toFixed(2));

      if (variance < 0) {
        // Negative variance = Shrinkage / Spoilage / Wastage
        totalShrinkageLoss += Math.abs(varianceValue);
      } else if (variance > 0) {
        // Positive variance = Unrecorded supplier surplus or measurement discrepancy
        totalSurplusGain += varianceValue;
      }

      // Update actual stock in inventory
      item.currentStock = counted;

      itemVariances.push({
        inventoryId: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        costPerUnit: item.costPerUnit,
        theoreticalStock: theoretical,
        countedStock: counted,
        variance,
        varianceValue,
        status: variance === 0 ? "EXACT" : variance < 0 ? "SHRINKAGE" : "SURPLUS",
        notes: entry.notes || (variance < 0 ? "Normal preparation loss & spillage" : "")
      });
    }

    const auditSummary = {
      id: auditId,
      timestamp,
      dateFormatted: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      auditor,
      totalItemsAudited: itemVariances.length,
      totalShrinkageLoss: parseFloat(totalShrinkageLoss.toFixed(2)),
      totalSurplusGain: parseFloat(totalSurplusGain.toFixed(2)),
      netImpact: parseFloat((totalSurplusGain - totalShrinkageLoss).toFixed(2)),
      variances: itemVariances
    };

    db.addAuditLog(auditSummary);
    db.save();

    console.log(`[AuditService] Audit ${auditId} completed. Shrinkage impact: ₹${totalShrinkageLoss.toFixed(2)} across ${itemVariances.length} items.`);

    return auditSummary;
  }
}

const auditService = new AuditService();

module.exports = {
  auditService
};
