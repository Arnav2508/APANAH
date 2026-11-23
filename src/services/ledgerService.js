const { db } = require('../database');

/**
 * Real-Time Executive Financial Ledger Service
 * Aggregates live transaction streams, computes unit economics, payment split,
 * and maintains continuous P&L reporting for shopkeepers.
 */
class LedgerService {
  /**
   * Computes the real-time executive dashboard telemetry
   */
  getDashboardMetrics() {
    const orders = db.getOrders();
    const inventory = db.getInventory();
    const invoices = db.getInvoices();

    // 1. Core Financial Aggregates
    let totalRevenue = 0;
    let totalCOGS = 0;
    let totalGrossProfit = 0;

    // Payment method breakdown
    const paymentBreakdown = {
      UPI: { count: 0, amount: 0 },
      CASH: { count: 0, amount: 0 },
      CARD: { count: 0, amount: 0 }
    };

    // Item sales performance map
    const itemPerformance = {};

    // Hourly sales map (for peak hour graphs)
    const hourlySales = {};

    for (const order of orders) {
      totalRevenue += (order.totalRevenue || 0);
      totalCOGS += (order.totalCOGS || 0);
      totalGrossProfit += (order.grossProfit || 0);

      const mode = (order.paymentMode || 'UPI').toUpperCase();
      if (!paymentBreakdown[mode]) {
        paymentBreakdown[mode] = { count: 0, amount: 0 };
      }
      paymentBreakdown[mode].count += 1;
      paymentBreakdown[mode].amount += order.totalRevenue;

      // Extract hour
      const orderDate = new Date(order.timestamp);
      const hourKey = `${orderDate.getHours()}:00`;
      hourlySales[hourKey] = (hourlySales[hourKey] || 0) + order.totalRevenue;

      // Items performance
      if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
          if (!itemPerformance[item.name]) {
            itemPerformance[item.name] = {
              name: item.name,
              category: item.category,
              quantity: 0,
              revenue: 0,
              profit: 0
            };
          }
          itemPerformance[item.name].quantity += item.quantity;
          itemPerformance[item.name].revenue += item.subtotal;
          itemPerformance[item.name].profit += item.grossMargin;
        }
      }
    }

    const netMarginPercent = totalRevenue > 0 ? parseFloat(((totalGrossProfit / totalRevenue) * 100).toFixed(1)) : 0;

    // 2. Inventory Valuation & Alerts
    let totalStockValuation = 0;
    const lowStockAlerts = [];

    for (const item of inventory) {
      const value = item.currentStock * item.costPerUnit;
      totalStockValuation += value;

      if (item.currentStock <= item.minThreshold) {
        lowStockAlerts.push({
          id: item.id,
          name: item.name,
          category: item.category,
          currentStock: item.currentStock,
          unit: item.unit,
          minThreshold: item.minThreshold,
          costPerUnit: item.costPerUnit,
          urgency: item.currentStock === 0 ? "CRITICAL" : "LOW"
        });
      }
    }

    // Top selling items sorted by quantity and profit
    const topSellingDishes = Object.values(itemPerformance)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Recent transaction feed (last 10)
    const recentOrders = orders.slice(0, 10);

    // Supplier Invoice Spend
    const totalSupplierInvoiceSpend = invoices.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);

    return {
      overview: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalCOGS: parseFloat(totalCOGS.toFixed(2)),
        grossProfit: parseFloat(totalGrossProfit.toFixed(2)),
        netMarginPercent,
        totalOrdersCount: orders.length,
        averageOrderValue: orders.length > 0 ? parseFloat((totalRevenue / orders.length).toFixed(1)) : 0,
        totalStockValuation: parseFloat(totalStockValuation.toFixed(2)),
        totalSupplierSpend: parseFloat(totalSupplierInvoiceSpend.toFixed(2)),
        lowStockCount: lowStockAlerts.length
      },
      paymentBreakdown: {
        UPI: { ...paymentBreakdown.UPI, percentage: totalRevenue > 0 ? ((paymentBreakdown.UPI.amount / totalRevenue) * 100).toFixed(1) : 0 },
        CASH: { ...paymentBreakdown.CASH, percentage: totalRevenue > 0 ? ((paymentBreakdown.CASH.amount / totalRevenue) * 100).toFixed(1) : 0 },
        CARD: { ...paymentBreakdown.CARD, percentage: totalRevenue > 0 ? ((paymentBreakdown.CARD.amount / totalRevenue) * 100).toFixed(1) : 0 }
      },
      topSellingDishes,
      lowStockAlerts,
      recentOrders,
      hourlySales
    };
  }
}

const ledgerService = new LedgerService();

module.exports = {
  ledgerService
};
