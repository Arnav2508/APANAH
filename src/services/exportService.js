const { db } = require('../database');

/**
 * Accounting Interoperability & Exporter Service
 * Generates standards-compliant data structures for Tally Prime XML,
 * Vyapar CSV, and Busy Accounting for seamless Indian tax & ledger synchronization.
 */
class ExportService {
  /**
   * Generates Tally Prime / ERP 9 Day Book XML
   */
  generateTallyXML() {
    const orders = db.getOrders();
    const merchant = db.state.merchant;

    let xml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${this.escapeXml(merchant.name)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>\n`;

    for (const order of orders) {
      const orderDate = new Date(order.timestamp);
      const tallyDate = orderDate.toISOString().slice(0, 10).replace(/-/g, '');
      const paymentLedger = order.paymentMode === 'CASH' ? 'Cash-in-Hand' : 'Bank Account (UPI QR)';

      xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <DATE>${tallyDate}</DATE>
            <GUID>APANAH-${order.id}</GUID>
            <NARRATION>Apanah AI POS Sale: Order ${order.id} | Payment: ${order.paymentMode}</NARRATION>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${order.id}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${paymentLedger}</PARTYLEDGERNAME>
            <EFFECTIVEDATE>${tallyDate}</EFFECTIVEDATE>
            
            <!-- Debit Payment Mode -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${paymentLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${order.totalRevenue.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <!-- Credit Sales Ledger -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${order.totalRevenue.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>\n`;
    }

    xml += `      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    return xml;
  }

  /**
   * Generates Vyapar-compatible CSV for POS Sales
   */
  generateVyaparSalesCSV() {
    const orders = db.getOrders();
    const rows = [
      ["Date", "Invoice No", "Party Name", "Item Name", "Quantity", "Unit", "Price/Unit", "Total Amount", "Payment Type", "Profit Margin"]
    ];

    for (const order of orders) {
      const date = order.timestamp.split('T')[0];
      const payment = order.paymentMode;

      for (const item of (order.items || [])) {
        rows.push([
          date,
          order.id,
          "Counter Retail Customer",
          `"${item.name.replace(/"/g, '""')}"`,
          item.quantity,
          "Plate/Unit",
          item.unitPrice,
          item.subtotal,
          payment,
          item.grossMargin
        ]);
      }
    }

    return rows.map(r => r.join(",")).join("\n");
  }

  /**
   * Generates Vyapar-compatible CSV for Supplier Purchases (Invoices)
   */
  generateVyaparPurchaseCSV() {
    const invoices = db.getInvoices();
    const rows = [
      ["Bill Date", "Bill No", "Supplier Name", "Item Description", "Quantity", "Unit", "Rate", "Total Amount", "Status"]
    ];

    for (const inv of invoices) {
      const date = inv.invoiceDate || (inv.committedAt ? inv.committedAt.split('T')[0] : '2026-11-23');
      for (const item of (inv.items || [])) {
        rows.push([
          date,
          inv.invoiceNumber,
          `"${inv.vendorName.replace(/"/g, '""')}"`,
          `"${item.name.replace(/"/g, '""')}"`,
          item.quantity,
          item.unit,
          item.unitPrice,
          item.total,
          inv.status
        ]);
      }
    }

    return rows.map(r => r.join(",")).join("\n");
  }

  escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'"]/g, c => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
      }
    });
  }
}

const exportService = new ExportService();

module.exports = {
  exportService
};
