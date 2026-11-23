/**
 * Apanah Frontend Reactive Client
 * Orchestrates Point-of-Sale, Multimodal Ingestion, Dynamic Recipe BOM,
 * and Real-Time Financial Telemetry.
 */

// Application State
const state = {
  menu: [],
  inventory: [],
  cart: {}, // { menuItemId: quantity }
  activeCategory: 'all',
  paymentMode: 'UPI',
  activeExtractedBill: null,
  dashboardMetrics: null
};

// Subtle audio chime for cashier feedback
function playChime(success = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (success) {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    } else {
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(180, ctx.currentTime + 0.18);
    }
    
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {
    // AudioContext might be blocked until user gesture, safe to ignore
  }
}

// Toast notification helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast-item pointer-events-auto';
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 2800);
}

// 1. Initial Data Fetching
async function initApp() {
  await Promise.all([
    fetchMenu(),
    fetchInventory(),
    fetchDashboardMetrics()
  ]);
  setupEventListeners();
  renderPOSMenu();
  renderInventoryTable();
  renderRecipeInspector();
  renderWeeklyAuditTable();
  if (window.lucide) window.lucide.createIcons();
}

async function fetchMenu() {
  try {
    const res = await fetch('/api/menu');
    const data = await res.json();
    if (data.success) {
      state.menu = data.data;
    }
  } catch (err) {
    console.error("Failed to fetch menu:", err);
  }
}

async function fetchInventory() {
  try {
    const res = await fetch('/api/inventory');
    const data = await res.json();
    if (data.success) {
      state.inventory = data.data;
    }
  } catch (err) {
    console.error("Failed to fetch inventory:", err);
  }
}

async function fetchDashboardMetrics() {
  try {
    const res = await fetch('/api/analytics/dashboard');
    const data = await res.json();
    if (data.success) {
      state.dashboardMetrics = data.data;
      updateHeaderTicker(data.data);
      renderDashboard(data.data);
    }
  } catch (err) {
    console.error("Failed to fetch dashboard metrics:", err);
  }
}

// Header Ticker Update
function updateHeaderTicker(metrics) {
  const tickerSales = document.getElementById('ticker-sales');
  const tickerProfit = document.getElementById('ticker-profit');
  const tickerAlerts = document.getElementById('ticker-alerts');

  if (tickerSales) tickerSales.innerText = `₹${(metrics.overview.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  if (tickerProfit) tickerProfit.innerText = `₹${(metrics.overview.grossProfit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  if (tickerAlerts) {
    const count = metrics.overview.lowStockCount || 0;
    tickerAlerts.innerText = `${count} ${count === 1 ? 'item' : 'items'}`;
  }
}

// 2. POS Component & Cart Engine
function renderPOSMenu() {
  const container = document.getElementById('pos-menu-grid');
  if (!container) return;

  const filtered = state.menu.filter(item => {
    const matchesCat = state.activeCategory === 'all' || item.category === state.activeCategory;
    const searchVal = (document.getElementById('pos-search')?.value || '').toLowerCase();
    const matchesSearch = !searchVal || item.name.toLowerCase().includes(searchVal);
    return matchesCat && matchesSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="col-span-full py-8 text-center text-[#7D8696] text-xs">No matching dishes or products.</div>`;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const inCartQty = state.cart[item.id] || 0;
    const ingredientCount = item.recipe ? item.recipe.length : 0;

    return `
      <div class="menu-card ${inCartQty > 0 ? 'in-cart' : ''} flex flex-col justify-between"
           onclick="handleAddToCart('${item.id}')">
        <div>
          <div class="flex items-baseline justify-between mb-1">
            <span class="text-xs text-[#7D8696]">${item.category}</span>
            ${inCartQty > 0 ? `<span class="text-xs font-bold text-[#C8511B]">${inCartQty} in cart</span>` : ''}
          </div>
          <h4 class="font-semibold text-xs text-[#141923] leading-snug">${item.name}</h4>
          <p class="text-[12px] text-[#525B6C] mt-0.5 line-clamp-1">${item.description}</p>
        </div>

        <div class="mt-2.5 pt-2 border-t border-[#ECE9E1] flex items-baseline justify-between">
          <span class="font-serif font-bold text-sm text-[#141923] tabular">₹${item.price}</span>
          <span class="text-[11px] text-[#7D8696]">
            ${ingredientCount} ${ingredientCount === 1 ? 'ingredient' : 'ingredients'}
          </span>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

window.handleAddToCart = function(menuItemId) {
  state.cart[menuItemId] = (state.cart[menuItemId] || 0) + 1;
  renderPOSMenu();
  renderCart();
  playChime(true);
};

window.handleUpdateCartQty = function(menuItemId, delta) {
  const current = state.cart[menuItemId] || 0;
  const newQty = current + delta;
  if (newQty <= 0) {
    delete state.cart[menuItemId];
  } else {
    state.cart[menuItemId] = newQty;
  }
  renderPOSMenu();
  renderCart();
};

async function renderCart() {
  const cartList = document.getElementById('pos-cart-list');
  const marginEl = document.getElementById('pos-margin');
  const totalEl = document.getElementById('pos-total');
  const checkoutBtn = document.getElementById('btn-checkout');
  const bomPreview = document.getElementById('cart-bom-preview');
  const bomSummary = document.getElementById('bom-deduction-summary');
  const bomEstCogs = document.getElementById('bom-est-cogs');

  const cartEntries = Object.entries(state.cart);

  if (cartEntries.length === 0) {
    cartList.innerHTML = `
      <div class="text-center py-8 text-[#7D8696] text-xs">
        Bill is empty. Tap any dish on the left.
      </div>
    `;
    marginEl.innerText = '₹0.00 (0%)';
    totalEl.innerText = '₹0.00';
    checkoutBtn.disabled = true;
    bomPreview.classList.add('hidden');
    return;
  }

  checkoutBtn.disabled = false;
  let totalRevenue = 0;
  const orderItemsForSimulation = [];

  const cartHtml = cartEntries.map(([menuId, qty]) => {
    const item = state.menu.find(m => m.id === menuId);
    if (!item) return '';

    const lineTotal = item.price * qty;
    totalRevenue += lineTotal;
    orderItemsForSimulation.push({ menuItemId: menuId, quantity: qty });

    return `
      <div class="py-1.5 border-b border-[#ECE9E1] flex items-center justify-between text-xs">
        <div class="flex-1 pr-2">
          <span class="font-medium text-[#141923]">${item.name}</span>
          <span class="text-[#7D8696] block text-[11px]">₹${item.price} × ${qty}</span>
        </div>
        <div class="flex items-center space-x-2">
          <div class="inline-flex border border-[#D8D3C7] bg-white">
            <button class="px-2 py-0.5 text-[#525B6C] hover:bg-[#F0EDE5]" onclick="handleUpdateCartQty('${menuId}', -1)">−</button>
            <span class="px-2 py-0.5 font-semibold text-xs tabular text-[#141923]">${qty}</span>
            <button class="px-2 py-0.5 text-[#525B6C] hover:bg-[#F0EDE5]" onclick="handleUpdateCartQty('${menuId}', 1)">+</button>
          </div>
          <span class="font-semibold text-[#141923] min-w-[48px] text-right tabular">₹${lineTotal}</span>
        </div>
      </div>
    `;
  }).join('');

  cartList.innerHTML = cartHtml;
  totalEl.innerText = `₹${totalRevenue.toFixed(2)}`;

  // Simulate BOM recipe deduction in real time
  try {
    const simRes = await fetch('/api/pos/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: orderItemsForSimulation })
    });
    const simData = await simRes.json();
    if (simData.success) {
      const sim = simData.data;
      marginEl.innerText = `₹${sim.profit.toFixed(2)} (${sim.margin}%)`;
      bomPreview.classList.remove('hidden');
      bomEstCogs.innerText = `COGS: ₹${sim.cogs.toFixed(2)}`;
      
      const deductions = sim.recipePreview.slice(0, 3).map(d => `${d.rawName}: -${d.deduction}`).join(', ');
      bomSummary.innerText = `Deducting ${deductions}${sim.recipePreview.length > 3 ? '...' : ''}`;
    }
  } catch (err) {
    console.error("Simulation error:", err);
  }
}

// POS Checkout
async function handleCheckout() {
  const checkoutBtn = document.getElementById('btn-checkout');
  const cartEntries = Object.entries(state.cart);
  if (cartEntries.length === 0) return;

  checkoutBtn.disabled = true;
  checkoutBtn.innerText = "Deducting stock...";

  const orderPayload = {
    items: cartEntries.map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
    paymentMode: state.paymentMode
  };

  try {
    const res = await fetch('/api/pos/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });
    const data = await res.json();

    if (data.success) {
      playChime(true);
      showToast(`Sale recorded: ₹${data.data.totalRevenue} (${data.data.paymentMode}). Stock deducted.`, 'success');
      
      state.cart = {};
      
      await Promise.all([
        fetchInventory(),
        fetchDashboardMetrics()
      ]);

      renderPOSMenu();
      renderCart();
      renderInventoryTable();
      renderWeeklyAuditTable();
    } else {
      playChime(false);
      showToast(`Order failed: ${data.error}`, 'error');
    }
  } catch (err) {
    playChime(false);
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    checkoutBtn.disabled = false;
    checkoutBtn.innerText = "Record sale and deduct stock";
  }
}

// 3. Multimodal OCR & Zero-Typing Supplier Bill Ingestion
async function handleBillUpload(file) {
  const emptyState = document.getElementById('ocr-empty-state');
  emptyState.innerHTML = `
    <div class="py-8 space-y-1 text-center">
      <p class="font-medium text-[#141923]">Reading supplier bill...</p>
      <p class="text-xs text-[#7D8696]">Extracting line items and matching inventory units.</p>
    </div>
  `;

  const formData = new FormData();
  formData.append('billImage', file);

  try {
    const res = await fetch('/api/bills/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      state.activeExtractedBill = data.data;
      renderExtractedBill(data.data);
      showToast(`Extracted bill: ${data.data.vendorName}`, 'success');
    } else {
      showToast(`Could not read bill: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

async function handleSampleBill(sampleType) {
  const emptyState = document.getElementById('ocr-empty-state');
  emptyState.innerHTML = `
    <div class="py-8 space-y-1 text-center">
      <p class="font-medium text-[#141923]">Reading sample invoice...</p>
      <p class="text-xs text-[#7D8696]">Extracting line items and matching inventory units.</p>
    </div>
  `;

  try {
    const res = await fetch('/api/bills/parse-sample', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sampleType })
    });
    const data = await res.json();
    if (data.success) {
      state.activeExtractedBill = data.data;
      renderExtractedBill(data.data);
      showToast(`Parsed: ${data.data.vendorName}`, 'success');
    }
  } catch (err) {
    showToast(`Sample error: ${err.message}`, 'error');
  }
}

function renderExtractedBill(bill) {
  const emptyState = document.getElementById('ocr-empty-state');
  const activeCard = document.getElementById('ocr-active-card');

  emptyState.classList.add('hidden');
  activeCard.classList.remove('hidden');

  activeCard.innerHTML = `
    <div class="space-y-4">
      
      <!-- Vendor Metadata -->
      <div class="flex flex-wrap items-baseline justify-between pb-3 border-b border-[#D8D3C7] gap-2">
        <div>
          <h3 class="font-serif text-lg font-bold text-[#141923]">${bill.vendorName}</h3>
          <p class="text-xs text-[#525B6C]">Invoice: ${bill.invoiceNumber} · Date: ${bill.invoiceDate}</p>
        </div>
        <div class="text-right">
          <span class="text-xs text-[#7D8696] block">Total</span>
          <span class="font-serif text-xl font-bold text-[#141923] tabular">₹${bill.totalAmount.toFixed(2)}</span>
        </div>
      </div>

      <!-- Line Items Table -->
      <div class="overflow-x-auto">
        <table class="ledger-table">
          <thead>
            <tr>
              <th>Extracted item</th>
              <th>Matched SKU</th>
              <th>Quantity</th>
              <th>Rate</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${bill.items.map(item => `
              <tr>
                <td class="font-medium text-[#141923]">${item.name}</td>
                <td>
                  <span class="text-xs ${item.isMatched ? 'text-[#185E39] font-medium' : 'text-[#525B6C]'}">
                    ${item.matchedInventoryName || 'New item'}
                  </span>
                </td>
                <td class="tabular">${item.quantity} ${item.unit}</td>
                <td class="tabular">₹${item.unitPrice}</td>
                <td class="tabular font-semibold text-[#141923]">₹${item.total}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Single Action Focal Point -->
      <div class="pt-3 border-t border-[#D8D3C7] flex items-center justify-between">
        <span class="text-xs text-[#525B6C]">Confirming updates your stock balances immediately.</span>
        <button id="btn-confirm-bill" onclick="handleConfirmBill()" class="btn-primary text-xs py-2 px-4">
          Confirm and add to stock
        </button>
      </div>

    </div>
  `;
}

window.handleConfirmBill = async function() {
  if (!state.activeExtractedBill) return;
  const btn = document.getElementById('btn-confirm-bill');
  if (btn) {
    btn.disabled = true;
    btn.innerText = "Adding to stock...";
  }

  try {
    const res = await fetch('/api/bills/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.activeExtractedBill)
    });
    const data = await res.json();
    if (data.success) {
      playChime(true);
      showToast(`Stock updated with ${data.data.items.length} items from ${data.data.vendorName}`, 'success');
      state.activeExtractedBill = null;
      
      document.getElementById('ocr-active-card')?.classList.add('hidden');
      const emptyState = document.getElementById('ocr-empty-state');
      if (emptyState) {
        emptyState.classList.remove('hidden');
        emptyState.innerHTML = `
          <div class="py-8 space-y-1 text-center">
            <p class="font-medium text-[#185E39]">Bill added to stock.</p>
            <p class="text-xs text-[#525B6C]">Upload another bill or check updated balances in Stock & Recipes.</p>
          </div>
        `;
      }

      await Promise.all([
        fetchInventory(),
        fetchDashboardMetrics()
      ]);
      renderInventoryTable();
      renderWeeklyAuditTable();
    }
  } catch (err) {
    showToast(`Failed: ${err.message}`, 'error');
  }
};

// 4. Executive Dashboard Analytics Render
function renderDashboard(metrics) {
  const salesEl = document.getElementById('dash-sales');
  const cogsEl = document.getElementById('dash-cogs');
  const profitEl = document.getElementById('dash-profit');
  const marginPctEl = document.getElementById('dash-margin-pct');
  const ordersCountEl = document.getElementById('dash-orders-count');
  const aovEl = document.getElementById('dash-aov');
  const stockValEl = document.getElementById('dash-stock-val');
  const lowStockCountEl = document.getElementById('dash-low-stock-count');

  if (!metrics || !metrics.overview) return;

  const ov = metrics.overview;
  if (salesEl) salesEl.innerText = `₹${ov.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  if (cogsEl) cogsEl.innerText = `₹${ov.totalCOGS.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  if (profitEl) profitEl.innerText = `₹${ov.grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  if (marginPctEl) marginPctEl.innerText = `${ov.netMarginPercent}% gross margin`;
  if (ordersCountEl) ordersCountEl.innerText = `${ov.totalOrdersCount} ${ov.totalOrdersCount === 1 ? 'sale' : 'sales'}`;
  if (aovEl) aovEl.innerText = `Avg ₹${ov.averageOrderValue}`;
  if (stockValEl) stockValEl.innerText = `₹${ov.totalStockValuation.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  if (lowStockCountEl) lowStockCountEl.innerText = `${ov.lowStockCount} items below threshold`;

  // Payment Breakdown
  const pb = metrics.paymentBreakdown;
  if (pb) {
    const upiStat = document.getElementById('pay-upi-stat');
    const cashStat = document.getElementById('pay-cash-stat');
    const cardStat = document.getElementById('pay-card-stat');

    if (upiStat) upiStat.innerText = `₹${pb.UPI.amount.toFixed(2)} (${pb.UPI.percentage}%)`;
    if (cashStat) cashStat.innerText = `₹${pb.CASH.amount.toFixed(2)} (${pb.CASH.percentage}%)`;
    if (cardStat) cardStat.innerText = `₹${pb.CARD.amount.toFixed(2)} (${pb.CARD.percentage}%)`;
  }

  // Top Selling Dishes
  const topItemsTbody = document.getElementById('dash-top-items-tbody');
  if (topItemsTbody) {
    if (metrics.topSellingDishes && metrics.topSellingDishes.length > 0) {
      topItemsTbody.innerHTML = metrics.topSellingDishes.map(item => {
        const marginPct = item.revenue > 0 ? ((item.profit / item.revenue) * 100).toFixed(1) : 0;
        return `
          <tr>
            <td class="font-medium text-[#141923]">${item.name}</td>
            <td class="tabular">${item.quantity}</td>
            <td class="tabular">₹${item.revenue.toFixed(2)}</td>
            <td class="tabular font-medium text-[#185E39]">₹${item.profit.toFixed(2)}</td>
            <td class="tabular text-[#525B6C]">${marginPct}%</td>
          </tr>
        `;
      }).join('');
    } else {
      topItemsTbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-[#7D8696]">No sales recorded today yet.</td></tr>`;
    }
  }

  // Alerts List
  const alertsList = document.getElementById('dash-alerts-list');
  if (alertsList) {
    if (metrics.lowStockAlerts && metrics.lowStockAlerts.length > 0) {
      alertsList.innerHTML = metrics.lowStockAlerts.map(a => `
        <div class="flex justify-between py-1 border-b border-[#ECE9E1]">
          <span class="text-[#141923] font-medium">${a.name}</span>
          <span class="text-[#C8511B] font-semibold tabular">${a.currentStock} ${a.unit} left (min: ${a.minThreshold})</span>
        </div>
      `).join('');
    } else {
      alertsList.innerHTML = `<p class="text-[#7D8696] text-xs">All stock levels above threshold.</p>`;
    }
  }

  // Recent Orders Feed
  const recentOrdersEl = document.getElementById('dash-recent-orders');
  if (recentOrdersEl) {
    if (metrics.recentOrders && metrics.recentOrders.length > 0) {
      recentOrdersEl.innerHTML = metrics.recentOrders.map(o => `
        <div class="py-1.5 border-b border-[#ECE9E1] flex items-center justify-between text-xs">
          <div>
            <span class="font-medium text-[#141923]">${o.items.map(i => `${i.quantity}× ${i.name}`).join(', ')}</span>
            <span class="text-[#7D8696] text-[11px] block">${o.paymentMode} · ${o.displayTime}</span>
          </div>
          <div class="text-right">
            <span class="font-semibold text-[#141923] tabular block">₹${o.totalRevenue}</span>
            <span class="text-[11px] text-[#185E39] tabular">Profit: ₹${o.grossProfit}</span>
          </div>
        </div>
      `).join('');
    } else {
      recentOrdersEl.innerHTML = `<p class="text-[#7D8696] text-xs py-2">No counter transactions yet.</p>`;
    }
  }
}

// 5. Inventory & Recipe Explorer
function renderInventoryTable() {
  const tbody = document.getElementById('inventory-table-tbody');
  if (!tbody) return;

  tbody.innerHTML = state.inventory.map(item => {
    const isLow = item.currentStock <= item.minThreshold;
    return `
      <tr>
        <td>
          <span class="font-medium text-[#141923] block">${item.name}</span>
          <span class="text-[11px] text-[#7D8696]">${item.supplier || 'Wholesale supplier'}</span>
        </td>
        <td class="tabular font-semibold ${isLow ? 'text-[#C8511B]' : 'text-[#141923]'}">
          ${item.currentStock} ${item.unit}
        </td>
        <td class="tabular">₹${item.costPerUnit} / ${item.unit}</td>
        <td>
          <span class="text-xs font-medium ${isLow ? 'text-[#C8511B]' : 'text-[#185E39]'}">
            ${isLow ? 'Low stock' : 'In stock'}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

function renderRecipeInspector() {
  const select = document.getElementById('recipe-select-dish');
  const detailsCard = document.getElementById('recipe-details-card');
  if (!select || !detailsCard) return;

  select.innerHTML = state.menu.map(m => `<option value="${m.id}">${m.name} (₹${m.price})</option>`).join('');

  function updateRecipeCard(menuId) {
    const dish = state.menu.find(m => m.id === menuId);
    if (!dish) return;

    let calculatedCost = 0;
    const ingredientsHtml = (dish.recipe || []).map(r => {
      const raw = state.inventory.find(i => i.id === r.materialId);
      const cost = raw ? (r.quantity * raw.costPerUnit) : 0;
      calculatedCost += cost;
      return `
        <div class="flex justify-between py-1 border-b border-[#ECE9E1]">
          <span class="text-[#525B6C]">${raw ? raw.name : r.materialId}</span>
          <span class="tabular text-[#141923]">${r.quantity} ${r.unit} (₹${cost.toFixed(2)})</span>
        </div>
      `;
    }).join('');

    const profit = dish.price - calculatedCost;
    const margin = dish.price > 0 ? ((profit / dish.price) * 100).toFixed(1) : 0;

    detailsCard.innerHTML = `
      <div>
        <h4 class="font-semibold text-sm text-[#141923]">${dish.name}</h4>
        <p class="text-xs text-[#525B6C]">${dish.description}</p>
      </div>

      <div class="space-y-1">
        <span class="text-xs font-semibold text-[#141923] block">Ingredients (recipe formula):</span>
        ${ingredientsHtml}
      </div>

      <div class="pt-2 border-t border-[#D8D3C7] flex justify-between text-xs">
        <div>
          <span class="text-[#7D8696] block text-[11px]">Calculated cost:</span>
          <span class="font-semibold tabular text-[#141923]">₹${calculatedCost.toFixed(2)}</span>
        </div>
        <div>
          <span class="text-[#7D8696] block text-[11px]">Selling price:</span>
          <span class="font-semibold tabular text-[#141923]">₹${dish.price.toFixed(2)}</span>
        </div>
        <div>
          <span class="text-[#7D8696] block text-[11px]">Gross margin:</span>
          <span class="font-semibold tabular text-[#185E39]">₹${profit.toFixed(2)} (${margin}%)</span>
        </div>
      </div>
    `;
  }

  select.addEventListener('change', (e) => updateRecipeCard(e.target.value));
  if (state.menu.length > 0) {
    updateRecipeCard(state.menu[0].id);
  }
}

// 6. Weekly Physical Count Audit
function renderWeeklyAuditTable() {
  const tbody = document.getElementById('audit-table-tbody');
  if (!tbody) return;

  const rawItems = state.inventory.filter(i => i.type === 'raw_material');

  tbody.innerHTML = rawItems.map(item => `
    <tr data-item-id="${item.id}">
      <td class="font-medium text-[#141923]">${item.name}</td>
      <td class="tabular font-semibold text-[#525B6C]">${item.currentStock} ${item.unit}</td>
      <td>
        <input type="number" step="0.1" value="${item.currentStock}" 
               class="audit-input w-24 bg-white border border-[#D8D3C7] px-2 py-1 text-xs text-[#141923] tabular focus:outline-none focus:border-[#141923]" 
               oninput="calculateAuditVariance()">
      </td>
      <td class="audit-variance-cell tabular text-xs text-[#7D8696]">0.00 ${item.unit}</td>
      <td class="audit-loss-cell tabular font-semibold text-xs text-[#141923]">₹0.00</td>
    </tr>
  `).join('');

  calculateAuditVariance();
}

window.calculateAuditVariance = function() {
  const rows = document.querySelectorAll('#audit-table-tbody tr');
  let totalShrinkage = 0;

  rows.forEach(row => {
    const itemId = row.getAttribute('data-item-id');
    const item = state.inventory.find(i => i.id === itemId);
    const input = row.querySelector('.audit-input');
    const varCell = row.querySelector('.audit-variance-cell');
    const lossCell = row.querySelector('.audit-loss-cell');

    if (!item || !input) return;

    const counted = parseFloat(input.value) || 0;
    const diff = counted - item.currentStock;
    const loss = diff * item.costPerUnit;

    varCell.innerText = `${diff >= 0 ? '+' : ''}${diff.toFixed(2)} ${item.unit}`;
    varCell.className = `audit-variance-cell tabular text-xs ${diff < 0 ? 'text-[#9B2829] font-medium' : diff > 0 ? 'text-[#185E39] font-medium' : 'text-[#7D8696]'}`;

    lossCell.innerText = `${loss >= 0 ? '+' : ''}₹${loss.toFixed(2)}`;
    lossCell.className = `audit-loss-cell tabular text-xs font-semibold ${loss < 0 ? 'text-[#9B2829]' : loss > 0 ? 'text-[#185E39]' : 'text-[#525B6C]'}`;

    if (loss < 0) totalShrinkage += Math.abs(loss);
  });

  const totalLossEl = document.getElementById('audit-total-loss');
  if (totalLossEl) {
    totalLossEl.innerText = `₹${totalShrinkage.toFixed(2)}`;
  }
};

async function submitWeeklyAudit() {
  const rows = document.querySelectorAll('#audit-table-tbody tr');
  const auditEntries = [];

  rows.forEach(row => {
    const itemId = row.getAttribute('data-item-id');
    const input = row.querySelector('.audit-input');
    if (itemId && input) {
      auditEntries.push({
        inventoryId: itemId,
        countedStock: parseFloat(input.value) || 0,
        notes: "Weekly physical weigh-in"
      });
    }
  });

  try {
    const res = await fetch('/api/audit/reconcile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auditEntries, auditor: "Shopkeeper" })
    });
    const data = await res.json();
    if (data.success) {
      playChime(true);
      showToast(`Stock calibrated for ${data.data.totalItemsAudited} items.`, 'success');
      await Promise.all([
        fetchInventory(),
        fetchDashboardMetrics()
      ]);
      renderInventoryTable();
      renderWeeklyAuditTable();
    }
  } catch (err) {
    showToast(`Audit error: ${err.message}`, 'error');
  }
}

// 7. Navigation & Event Listeners
function setupEventListeners() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.view-panel').forEach(p => p.classList.add('hidden'));

      tab.classList.add('active');
      const targetId = tab.getAttribute('data-target');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.classList.remove('hidden');
    });
  });

  document.querySelectorAll('.cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeCategory = btn.getAttribute('data-cat');
      renderPOSMenu();
    });
  });

  const searchInput = document.getElementById('pos-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderPOSMenu());
  }

  const clearCartBtn = document.getElementById('btn-clear-cart');
  if (clearCartBtn) {
    clearCartBtn.addEventListener('click', () => {
      state.cart = {};
      renderPOSMenu();
      renderCart();
    });
  }

  document.querySelectorAll('.pay-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pay-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.paymentMode = btn.getAttribute('data-mode');
    });
  });

  const checkoutBtn = document.getElementById('btn-checkout');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', handleCheckout);
  }

  const dropzone = document.getElementById('dropzone-area');
  const fileInput = document.getElementById('bill-file-input');
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleBillUpload(e.target.files[0]);
      }
    });
  }

  document.querySelectorAll('.btn-sample-bill').forEach(btn => {
    btn.addEventListener('click', () => {
      const sample = btn.getAttribute('data-sample');
      handleSampleBill(sample);
    });
  });

  const submitAuditBtn = document.getElementById('btn-submit-audit');
  if (submitAuditBtn) {
    submitAuditBtn.addEventListener('click', submitWeeklyAudit);
  }

  const resetBtn = document.getElementById('btn-seed-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (!confirm("Reset database to initial Pune pilot state?")) return;
      try {
        const res = await fetch('/api/seed/reset', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          playChime(true);
          showToast("Data reset to initial state", 'success');
          state.cart = {};
          await initApp();
        }
      } catch (err) {
        showToast(`Reset error: ${err.message}`, 'error');
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});
