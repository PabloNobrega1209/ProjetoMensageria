// State Variables
let currentPage = 1;
let currentLimit = 20;
let totalPages = 1;
let currentFilters = {};

// Status Translations & Colors
const STATUS_CONFIG = {
  created: { label: 'Criado', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: 'fa-clock' },
  paid: { label: 'Pago', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: 'fa-circle-check' },
  separated: { label: 'Separado', badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', icon: 'fa-box' },
  shipped: { label: 'Enviado', badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20', icon: 'fa-truck-fast' },
  delivered: { label: 'Entregue', badge: 'bg-teal-500/10 text-teal-400 border-teal-500/20', icon: 'fa-house-circle-check' },
  canceled: { label: 'Cancelado', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: 'fa-circle-xmark' }
};

// Format BRL Currency
function formatCurrency(val) {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

// Format Date ISO to PT-BR
function formatDate(isoString) {
  if (!isoString) return '--';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

// Generate Status Badge HTML
function renderStatusBadge(status) {
  const conf = STATUS_CONFIG[status] || { label: status, badge: 'bg-slate-800 text-slate-300 border-slate-700', icon: 'fa-circle-info' };
  return `
    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${conf.badge}">
      <i class="fa-solid ${conf.icon}"></i> ${conf.label}
    </span>
  `;
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  checkHealth();
  loadDashboardData();
});

// Check API Health
async function checkHealth() {
  const badge = document.getElementById('healthBadge');
  const dot = document.getElementById('healthDot');
  const text = document.getElementById('healthText');
  try {
    const res = await fetch('/health');
    const data = await res.json();
    if (data.status === 'online') {
      dot.className = 'w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50';
      text.textContent = 'API Online';
      text.className = 'text-emerald-400 font-semibold';
      badge.className = 'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 border border-emerald-500/20';
    } else {
      throw new Error('API Offline');
    }
  } catch (err) {
    dot.className = 'w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50';
    text.textContent = 'API Offline';
    text.className = 'text-rose-400 font-semibold';
    badge.className = 'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-rose-500/10 border border-rose-500/20';
  }
}

// Main load data function
async function loadDashboardData() {
  const refreshIcon = document.getElementById('refreshIcon');
  if (refreshIcon) refreshIcon.classList.add('fa-spin');
  
  await Promise.all([
    loadFinancialSummary(),
    loadOrders()
  ]);

  if (refreshIcon) setTimeout(() => refreshIcon.classList.remove('fa-spin'), 500);
}

// Fetch and Render Financial Summary KPIs
async function loadFinancialSummary() {
  try {
    const params = new URLSearchParams();
    if (currentFilters['seller.id']) params.append('seller.id', currentFilters['seller.id']);
    
    const url = `/orders/financial-summary${params.toString() ? '?' + params.toString() : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Falha ao obter resumo financeiro');
    const data = await res.json();

    document.getElementById('kpiTotalOrders').textContent = data.total_orders ?? 0;
    document.getElementById('kpiTotalRevenue').textContent = formatCurrency(data.total_revenue);
    document.getElementById('kpiAverageOrder').textContent = formatCurrency(data.average_order_value);

    // Payment Methods Breakdown
    const pmContainer = document.getElementById('kpiPaymentMethods');
    const methods = data.by_payment_method || {};
    const methodKeys = Object.keys(methods);
    if (methodKeys.length === 0) {
      pmContainer.innerHTML = '<span class="text-slate-500">Sem dados de pagamento</span>';
    } else {
      pmContainer.innerHTML = methodKeys.map(method => `
        <div class="flex items-center justify-between py-1 border-b border-slate-800/50 last:border-0">
          <span class="font-medium text-slate-300 capitalize"><i class="fa-solid fa-angle-right text-[10px] text-sky-400 mr-1"></i>${method}</span>
          <span class="text-slate-400">${methods[method].count}x <strong class="text-slate-200">${formatCurrency(methods[method].total)}</strong></span>
        </div>
      `).join('');
    }

    // Status Distribution Cards
    const statusContainer = document.getElementById('statusDistribution');
    const statusCounts = data.by_status || {};
    const allStatuses = ['created', 'paid', 'separated', 'shipped', 'delivered', 'canceled'];
    
    statusContainer.innerHTML = allStatuses.map(st => {
      const count = statusCounts[st] || 0;
      const conf = STATUS_CONFIG[st];
      return `
        <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-center group hover:border-slate-700 transition">
          <span class="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <i class="fa-solid ${conf.icon} text-[11px]"></i> ${conf.label}
          </span>
          <span class="text-xl font-bold text-white">${count}</span>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Erro no resumo financeiro:', err);
  }
}

// Fetch and Render Orders Table
async function loadOrders() {
  const tbody = document.getElementById('ordersTableBody');
  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="py-12 text-center text-slate-400">
        <i class="fa-solid fa-circle-notch fa-spin text-2xl text-sky-500 mb-2"></i>
        <p>Buscando pedidos do servidor...</p>
      </td>
    </tr>
  `;

  try {
    const params = new URLSearchParams({
      page: currentPage,
      limit: currentLimit,
      ...currentFilters
    });

    const res = await fetch(`/orders?${params.toString()}`);
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Erro ao carregar lista de pedidos');
    }

    const data = await res.json();
    totalPages = data.total_pages || 1;

    renderOrdersTable(data.data || []);
    renderPagination(data.page, data.total_pages, data.total, data.limit);

  } catch (err) {
    console.error('Erro na busca de pedidos:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-rose-400">
          <i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i>
          <p class="font-semibold">${err.message}</p>
        </td>
      </tr>
    `;
  }
}

// Render Rows in Table
function renderOrdersTable(orders) {
  const tbody = document.getElementById('ordersTableBody');
  if (orders.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-12 text-center text-slate-500">
          <i class="fa-solid fa-folder-open text-3xl mb-2"></i>
          <p>Nenhum pedido encontrado com os filtros selecionados.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = orders.map(order => `
    <tr class="hover:bg-slate-800/40 transition border-b border-slate-800/40">
      <td class="py-3.5 px-4 font-mono font-medium text-sky-400 whitespace-nowrap">
        ${order.uuid}
      </td>
      <td class="py-3.5 px-4 text-slate-300 whitespace-nowrap">
        ${formatDate(order.created_at)}
      </td>
      <td class="py-3.5 px-4">
        <div class="font-semibold text-slate-200">${escapeHtml(order.customer.name)}</div>
        <div class="text-[11px] text-slate-400">${escapeHtml(order.customer.email)}</div>
      </td>
      <td class="py-3.5 px-4">
        <div class="font-medium text-slate-200">${escapeHtml(order.seller.name)}</div>
        <div class="text-[11px] text-slate-400">${escapeHtml(order.seller.city)} / ${escapeHtml(order.seller.state)}</div>
      </td>
      <td class="py-3.5 px-4 font-bold text-slate-100 whitespace-nowrap">
        ${formatCurrency(order.total)}
      </td>
      <td class="py-3.5 px-4 whitespace-nowrap">
        ${renderStatusBadge(order.status)}
      </td>
      <td class="py-3.5 px-4 text-center whitespace-nowrap">
        <button onclick="viewOrderDetails('${order.uuid}')" class="px-3 py-1.5 bg-slate-800 hover:bg-sky-600 hover:text-white text-slate-300 rounded-lg text-xs font-medium border border-slate-700 hover:border-sky-500 transition shadow-sm flex items-center gap-1.5 mx-auto">
          <i class="fa-solid fa-eye"></i> Detalhes
        </button>
      </td>
    </tr>
  `).join('');
}

// Render Pagination Controls
function renderPagination(page, totalPgs, totalRecords, limit) {
  document.getElementById('pageIndicator').textContent = `${page} / ${totalPgs || 1}`;
  document.getElementById('btnPrevPage').disabled = page <= 1;
  document.getElementById('btnNextPage').disabled = page >= totalPgs;

  const startRecord = totalRecords === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalRecords);
  document.getElementById('paginationInfo').textContent = `Mostrando ${startRecord} - ${endRecord} de ${totalRecords} pedidos`;
}

// Handle Filter Form Submit
function handleFilterSubmit(e) {
  e.preventDefault();
  currentPage = 1;
  
  const status = document.getElementById('filterStatus').value;
  const customerId = document.getElementById('filterCustomerId').value;
  const sellerId = document.getElementById('filterSellerId').value;
  const productId = document.getElementById('filterProductId').value;

  currentFilters = {};
  if (status) currentFilters.status = status;
  if (customerId) currentFilters['customer.id'] = customerId;
  if (sellerId) currentFilters['seller.id'] = sellerId;
  if (productId) currentFilters['product.id'] = productId;

  loadDashboardData();
}

// Clear Filters
function clearFilters() {
  document.getElementById('filterForm').reset();
  currentFilters = {};
  currentPage = 1;
  loadDashboardData();
}

// Change Page Size Limit
function changeLimit(newLimit) {
  currentLimit = Number(newLimit);
  currentPage = 1;
  loadOrders();
}

// Page Navigation
function changePage(delta) {
  const newPage = currentPage + delta;
  if (newPage >= 1 && newPage <= totalPages) {
    currentPage = newPage;
    loadOrders();
  }
}

// View Detailed Modal for an Order
async function viewOrderDetails(uuid) {
  const modal = document.getElementById('orderModal');
  const content = document.getElementById('modalContent');
  const uuidSpan = document.getElementById('modalOrderUuid');
  const datesSpan = document.getElementById('modalOrderDates');
  const channelSpan = document.getElementById('modalChannel');

  uuidSpan.textContent = uuid;
  datesSpan.textContent = 'Carregando...';
  channelSpan.textContent = 'Canal: --';
  
  content.innerHTML = `
    <div class="text-center py-12 text-slate-400">
      <i class="fa-solid fa-spinner fa-spin text-2xl text-sky-500 mb-2"></i>
      <p>Carregando informações detalhadas...</p>
    </div>
  `;

  modal.classList.remove('hidden');

  try {
    const res = await fetch(`/orders/${uuid}`);
    if (!res.ok) throw new Error('Falha ao carregar detalhes do pedido');
    const order = await res.json();

    datesSpan.textContent = `Criado em: ${formatDate(order.created_at)} | Indexado em: ${formatDate(order.indexed_at)}`;
    channelSpan.textContent = `Canal de Origem: ${order.channel || 'Desconhecido'}`;

    content.innerHTML = `
      <!-- Top Overview Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Customer Info -->
        <div class="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1">
          <div class="text-xs font-semibold text-sky-400 uppercase flex items-center gap-1.5 mb-2">
            <i class="fa-solid fa-user"></i> Cliente
          </div>
          <div class="font-bold text-slate-100 text-sm">${escapeHtml(order.customer.name)}</div>
          <div class="text-slate-400">CPF/Doc: ${escapeHtml(order.customer.document)}</div>
          <div class="text-slate-400">Email: ${escapeHtml(order.customer.email)}</div>
          <div class="text-slate-400">ID: ${order.customer.id}</div>
        </div>

        <!-- Seller Info -->
        <div class="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1">
          <div class="text-xs font-semibold text-indigo-400 uppercase flex items-center gap-1.5 mb-2">
            <i class="fa-solid fa-store"></i> Vendedor
          </div>
          <div class="font-bold text-slate-100 text-sm">${escapeHtml(order.seller.name)}</div>
          <div class="text-slate-400">Localização: ${escapeHtml(order.seller.city)} / ${escapeHtml(order.seller.state)}</div>
          <div class="text-slate-400">ID Vendedor: ${order.seller.id}</div>
        </div>

        <!-- Status & Payment Overview -->
        <div class="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1">
          <div class="text-xs font-semibold text-emerald-400 uppercase flex items-center gap-1.5 mb-2">
            <i class="fa-solid fa-circle-check"></i> Status & Valor
          </div>
          <div class="flex items-center gap-2 my-1">
            ${renderStatusBadge(order.status)}
          </div>
          <div class="text-slate-300 font-semibold text-base mt-2">
            Total: <span class="text-emerald-400">${formatCurrency(order.total)}</span>
          </div>
        </div>
      </div>

      <!-- Payment & Shipment Details (JSONB) -->
      ${order.payment || order.shipment ? `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${order.payment ? `
        <div class="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
          <div class="font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
            <i class="fa-solid fa-credit-card text-amber-400"></i> Dados de Pagamento
          </div>
          <pre class="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">${JSON.stringify(order.payment, null, 2)}</pre>
        </div>` : ''}

        ${order.shipment ? `
        <div class="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
          <div class="font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
            <i class="fa-solid fa-truck text-sky-400"></i> Dados de Envio
          </div>
          <pre class="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">${JSON.stringify(order.shipment, null, 2)}</pre>
        </div>` : ''}
      </div>` : ''}

      <!-- Items Table -->
      <div>
        <h4 class="font-bold text-slate-200 text-sm mb-3 flex items-center gap-2">
          <i class="fa-solid fa-boxes-stacked text-sky-400"></i> Itens do Pedido (${order.items.length})
        </h4>
        <div class="overflow-x-auto rounded-xl border border-slate-800">
          <table class="w-full text-left text-xs text-slate-300">
            <thead class="bg-slate-950 text-slate-400 uppercase font-semibold">
              <tr>
                <th class="py-3 px-4"># ID</th>
                <th class="py-3 px-4">Produto</th>
                <th class="py-3 px-4">Categoria</th>
                <th class="py-3 px-4 text-center">Quantidade</th>
                <th class="py-3 px-4 text-right">Preço Unitário</th>
                <th class="py-3 px-4 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800 bg-slate-900/60">
              ${order.items.map(item => `
                <tr class="hover:bg-slate-800/40">
                  <td class="py-3 px-4 font-mono text-slate-400">${item.id}</td>
                  <td class="py-3 px-4">
                    <div class="font-semibold text-slate-100">${escapeHtml(item.product.title)}</div>
                    <div class="text-[10px] font-mono text-slate-400">ID: ${escapeHtml(item.product.id)}</div>
                  </td>
                  <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                      ${item.category && item.category.name ? escapeHtml(item.category.name) : JSON.stringify(item.category)}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-center font-bold text-slate-200">${item.quantity}</td>
                  <td class="py-3 px-4 text-right text-slate-300">${formatCurrency(item.unit_price)}</td>
                  <td class="py-3 px-4 text-right font-bold text-emerald-400">${formatCurrency(item.total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

  } catch (err) {
    console.error('Erro ao abrir detalhes:', err);
    content.innerHTML = `
      <div class="text-center py-8 text-rose-400">
        <i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i>
        <p class="font-semibold">${err.message}</p>
      </div>
    `;
  }
}

// Close Modal
function closeModal() {
  document.getElementById('orderModal').classList.add('hidden');
}

// Escape HTML for XSS prevention
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
