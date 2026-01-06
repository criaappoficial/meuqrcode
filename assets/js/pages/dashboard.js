import { observeAuth, logoutUser } from '../controllers/authController.js';
import { QRController, drawQRCode, downloadQRCode } from '../controllers/qrController.js';
import { showAlert, toggleState, renderRows, formatDate } from '../views/ui.js';

const PRIMARY_DOMAIN = 'https://qrcode-alugueja.netlify.app';
const BASE_URL = (['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)) ? window.location.origin : PRIMARY_DOMAIN;
const composeQrUrl = (id) => (BASE_URL === window.location.origin)
  ? `${window.location.origin}/page/index.html?id=${id}`
  : `${PRIMARY_DOMAIN}/${id}`;

const els = {
  logoutBtn: document.getElementById('logoutBtn'),
  loading: document.getElementById('loading'),
  tableWrap: document.getElementById('qrcodes-container'),
  emptyState: document.getElementById('empty-state'),
  tableBody: document.getElementById('qrcodes-table-body'),
  alert: document.getElementById('alert-container'),
  deleteModal: document.getElementById('deleteModal'),
  confirmDelete: document.getElementById('confirmDelete'),
  cancelDelete: document.getElementById('cancelDelete'),
  qrPreviewModal: document.getElementById('qrPreviewModal'),
  qrPreviewUrl: document.getElementById('qrPreviewUrl'),
  qrPreviewCanvas: document.getElementById('qrPreviewCanvas'),
  openCalc: document.getElementById('openCalc'),
  closeCalc: document.getElementById('closeCalc'),
  calcPanel: document.getElementById('calcPanel'),
  calcIncludedLinks: document.getElementById('calcIncludedLinks'),
  calcExtraLinks: document.getElementById('calcExtraLinks'),
  calcExtraColors: document.getElementById('calcExtraColors'),
  calcExtraSizes: document.getElementById('calcExtraSizes'),
  calcTotal: document.getElementById('calcTotal'),
  searchInput: document.getElementById('searchInput'),
  statusFilter: document.getElementById('statusFilter'),
  sidebarToggle: document.getElementById('sidebarToggle'),
  sidebarClose: document.getElementById('sidebarClose'),
  sidebarMinimize: document.getElementById('sidebarMinimize'),
  sidebarOverlay: document.getElementById('sidebarOverlay'),
  sidebar: document.querySelector('.sidebar'),
  mainContent: document.querySelector('.main-content'),
  statTotal: document.getElementById('statTotal'),
  statActive: document.getElementById('statActive'),
  statInactive: document.getElementById('statInactive'),
  statCustom: document.getElementById('statCustom'),
  headerBalanceTotal: document.getElementById('headerBalanceTotal'),
  balanceTrigger: document.getElementById('balanceTrigger')
};

let selectedDocId = null;
let currentUserId = null;
let currentQrCodes = [];
const BASE_RULES = {
  includedLinks: 3,
  baseStyles: ['dark', 'invert'],
  baseSizes: [200, 320],
  pricePerExtraLink: 5.0,
  pricePerExtraColor: 2.5,
  pricePerExtraSize: 4.0,
  baseColorCombos: [
    ['#000000', '#FFFFFF'],
    ['#FFFFFF', '#000000']
  ]
};

// Sidebar Logic
els.sidebarToggle?.addEventListener('click', () => {
  els.sidebar.classList.toggle('active');
  els.sidebarOverlay.classList.toggle('active');
});

els.sidebarClose?.addEventListener('click', () => {
  els.sidebar.classList.remove('active');
  els.sidebarOverlay.classList.remove('active');
});

els.sidebarOverlay?.addEventListener('click', () => {
  els.sidebar.classList.remove('active');
  els.sidebarOverlay.classList.remove('active');
});

// Sidebar Minimize Logic
function toggleSidebar() {
  const isCollapsed = els.sidebar.classList.toggle('collapsed');
  els.mainContent.classList.toggle('expanded');
  localStorage.setItem('sidebarCollapsed', isCollapsed);
  
  // Update icon direction
  const icon = els.sidebarMinimize?.querySelector('i');
  if (icon) {
    icon.style.transform = isCollapsed ? 'rotate(180deg)' : '';
  }
}

els.sidebarMinimize?.addEventListener('click', toggleSidebar);

// Initialize Sidebar State
if (localStorage.getItem('sidebarCollapsed') === 'true') {
  els.sidebar.classList.add('collapsed');
  els.mainContent.classList.add('expanded');
  const icon = els.sidebarMinimize?.querySelector('i');
  if (icon) icon.style.transform = 'rotate(180deg)';
}

observeAuth((user) => {
  currentUserId = user?.uid || null;
  const hour = new Date().getHours();
  const saudacao = (hour >= 5 && hour < 12) ? 'Bom dia' : (hour >= 12 && hour < 18) ? 'Boa tarde' : 'Boa noite';
  const shortName = (() => {
    const dn = (user?.displayName || '').trim();
    if (dn) return dn.split(/\s+/)[0];
    const em = (user?.email || '').split('@')[0];
    if (em) return (em.split('.')[0] || em);
    return 'Usuário';
  })();
  const greetingText = `Olá, ${shortName}! ${saudacao}`;
  const greetingEl = document.getElementById('greeting');
  if (greetingEl) greetingEl.textContent = greetingText;
  const taglineEl = document.getElementById('dashboardTagline');
  if (taglineEl) taglineEl.textContent = greetingText;
  const badge = document.querySelector('.brand-badge');
  if (badge) {
    const initials = (() => {
      const display = user?.displayName || '';
      if (display.trim()) return display.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() || '').join('');
      const email = (user?.email || '').split('@')[0];
      return (email.slice(0, 2) || 'QR').toUpperCase();
    })();
    badge.textContent = initials || 'QR';
  }
  
  const emailDisplay = document.getElementById('userEmailDisplay');
  if (emailDisplay) emailDisplay.textContent = user?.email || 'Usuário';

  loadDashboard();
}, () => window.location.replace('../login.html'));

els.openCalc?.addEventListener('click', () => els.calcPanel.classList.add('active'));
els.balanceTrigger?.addEventListener('click', () => {
  els.calcPanel.classList.toggle('active');
});
els.closeCalc?.addEventListener('click', () => els.calcPanel.classList.remove('active'));

els.logoutBtn?.addEventListener('click', async () => {
  await logoutUser();
  window.location.replace('../login.html');
});

els.tableBody?.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const docId = target.dataset.id;
  const title = target.dataset.title;
  const destination = target.dataset.destination;
  const publicId = target.dataset.publicId;

  if (target.dataset.action === 'edit') {
    window.location.href = `edit.html?id=${docId}`;
  }

  if (target.dataset.action === 'delete') {
    selectedDocId = docId;
    document.getElementById('modalMessage').innerHTML = `Tem certeza que deseja excluir <strong>${title || 'este QR Code'}</strong>?`;
    toggleState(els.deleteModal, true);
    setTimeout(() => els.deleteModal.classList.add('active'), 10);
  }

  if (target.dataset.action === 'preview') {
    if (!publicId) return;
    const fixedUrl = target.dataset.fixedUrl;
    const dest = target.dataset.destination || '';
    const isPix = /^000201/.test(dest) && /br\.gov\.bcb\.pix/.test(dest);
    const qrValue = isPix
      ? dest
      : ((BASE_URL === window.location.origin) ? composeQrUrl(publicId) : (fixedUrl || composeQrUrl(publicId)));
    
    const colorDark = target.dataset.colorDark || '#000000';
    const colorLight = target.dataset.colorLight || '#FFFFFF';
    const size = parseInt(target.dataset.size || 320, 10);
    const opts = { width: size, color: { dark: colorDark, light: colorLight } };

    els.qrPreviewUrl.textContent = qrValue;
    toggleState(els.qrPreviewModal, true);
    setTimeout(() => els.qrPreviewModal.classList.add('active'), 10);
    drawQRCode('qrPreviewCanvas', qrValue, opts).catch(console.error);
  }

  if (target.dataset.action === 'download') {
    if (!publicId) return;
    const fixedUrl = target.dataset.fixedUrl;
    const dest = target.dataset.destination || '';
    const isPix = /^000201/.test(dest) && /br\.gov\.bcb\.pix/.test(dest);
    const qrValue = isPix
      ? dest
      : ((BASE_URL === window.location.origin) ? composeQrUrl(publicId) : (fixedUrl || composeQrUrl(publicId)));
    const filename = `${(title || 'qrcode').replace(/\s+/g, '-').toLowerCase()}-${publicId}.png`;
    
    const colorDark = target.dataset.colorDark || '#000000';
    const colorLight = target.dataset.colorLight || '#FFFFFF';
    const size = parseInt(target.dataset.size || 320, 10);
    const opts = { width: size, color: { dark: colorDark, light: colorLight } };

    drawQRCode('qrPreviewCanvas', qrValue, opts)
      .then(() => downloadQRCode('qrPreviewCanvas', filename))
      .catch(console.error);
  }

  if (target.dataset.action === 'print') {
    if (!publicId) return;
    const fixedUrl = target.dataset.fixedUrl;
    const dest = target.dataset.destination || '';
    const isPix = /^000201/.test(dest) && /br\.gov\.bcb\.pix/.test(dest);
    const qrValue = isPix
      ? dest
      : ((BASE_URL === window.location.origin) ? composeQrUrl(publicId) : (fixedUrl || composeQrUrl(publicId)));
      
    const colorDark = target.dataset.colorDark || '#000000';
    const colorLight = target.dataset.colorLight || '#FFFFFF';
    const size = parseInt(target.dataset.size || 320, 10);
    const opts = { width: size, color: { dark: colorDark, light: colorLight } };

    drawQRCode('qrPreviewCanvas', qrValue, opts)
      .then(() => {
        const canvas = document.getElementById('qrPreviewCanvas');
        if (!canvas) return;
        const w = window.open('');
        const img = canvas.toDataURL('image/png');
        w.document.write(`<img src="${img}" style="width:100%;max-width:480px;" onload="window.print();window.close();"/>`);
      })
      .catch(console.error);
  }
  
});

els.confirmDelete?.addEventListener('click', async () => {
  if (!selectedDocId) return;
  els.confirmDelete.disabled = true;
  els.confirmDelete.textContent = 'Excluindo...';
  try {
    await QRController.remove(selectedDocId);
    showAlert(els.alert, 'QR Code excluído.', 'success');
    els.deleteModal.classList.remove('active');
    setTimeout(() => toggleState(els.deleteModal, false), 300);
    await loadDashboard();
  } catch (error) {
    showAlert(els.alert, 'Erro ao excluir QR Code.', 'error');
  } finally {
    selectedDocId = null;
    els.confirmDelete.disabled = false;
    els.confirmDelete.textContent = 'Excluir';
  }
});

const closeModal = (modal) => {
  if (!modal) return;
  modal.classList.remove('active');
  setTimeout(() => toggleState(modal, false), 300);
};

els.cancelDelete?.addEventListener('click', () => closeModal(els.deleteModal));
document.getElementById('closeDeleteModal')?.addEventListener('click', () => closeModal(els.deleteModal));
document.getElementById('closeQrPreview')?.addEventListener('click', () => closeModal(els.qrPreviewModal));

// Close Modals on Escape Key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (els.deleteModal?.classList.contains('active')) closeModal(els.deleteModal);
    if (els.qrPreviewModal?.classList.contains('active')) closeModal(els.qrPreviewModal);
    if (els.calcPanel?.classList.contains('active')) els.calcPanel.classList.remove('active');
  }
});

async function loadDashboard() {
  try {
    toggleState(els.loading, true);
    const qrCodes = currentUserId ? await QRController.mine(currentUserId) : [];
    toggleState(els.loading, false);

    if (!qrCodes.length) {
      toggleState(els.emptyState, true);
      toggleState(els.tableWrap, false);
      currentQrCodes = [];
      updateCalculator();
      updateStats();
      return;
    }

    toggleState(els.emptyState, false);
    toggleState(els.tableWrap, true);
    currentQrCodes = qrCodes.slice();
    updateCalculator();
    updateStats();
    filterQrCodes(); // Initial render with filters
  } catch (error) {
    toggleState(els.loading, false);
    showAlert(els.alert, 'Erro ao carregar QR Codes.', 'error');
    console.error(error);
  }
}

function truncate(text = '', size = 48) {
  return text.length > size ? `${text.substring(0, size)}…` : text;
}

function currency(value) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function updateCalculator() {
  if (!els.calcIncludedLinks) return;
  const totalLinks = currentQrCodes.length;
  const extraLinks = Math.max(0, totalLinks - BASE_RULES.includedLinks);
  const extraColors = currentQrCodes.filter((qr) => {
    const style = (qr.style || 'dark');
    if (BASE_RULES.baseStyles.includes(style)) return false;
    const d = String(qr.colorDark || '#000000').toUpperCase();
    const l = String(qr.colorLight || '#FFFFFF').toUpperCase();
    return !BASE_RULES.baseColorCombos.some(([cd, cl]) => cd === d && cl === l);
  }).length;
  const extraSizes = currentQrCodes.filter((qr) => !BASE_RULES.baseSizes.includes(parseInt(qr.size || 320, 10))).length;
  const total = (extraLinks * BASE_RULES.pricePerExtraLink) + (extraColors * BASE_RULES.pricePerExtraColor) + (extraSizes * BASE_RULES.pricePerExtraSize);
  
  // Update UI with calculated values
  els.calcIncludedLinks.textContent = `${totalLinks} / ${BASE_RULES.includedLinks}`;
  els.calcExtraLinks.textContent = String(extraLinks);
  els.calcExtraColors.textContent = String(extraColors);
  els.calcExtraSizes.textContent = String(extraSizes);
  els.calcTotal.textContent = currency(total);
  if (els.headerBalanceTotal) els.headerBalanceTotal.textContent = currency(total);
}

function updateStats() {
  const total = currentQrCodes.length;
  const active = currentQrCodes.filter(q => q.active).length;
  const inactive = total - active;
  
  // Custom logic: considers a QR "customized" if it has non-standard colors or sizes
  const custom = currentQrCodes.filter((qr) => {
      const d = String(qr.colorDark || '#000000').toUpperCase();
      const l = String(qr.colorLight || '#FFFFFF').toUpperCase();
      const isBaseColor = BASE_RULES.baseColorCombos.some(([cd, cl]) => cd === d && cl === l);
      const isBaseSize = BASE_RULES.baseSizes.includes(parseInt(qr.size || 320, 10));
      return !isBaseColor || !isBaseSize;
  }).length;

  if (els.statTotal) els.statTotal.textContent = total;
  if (els.statActive) els.statActive.textContent = active;
  if (els.statInactive) els.statInactive.textContent = inactive;
  if (els.statCustom) els.statCustom.textContent = custom;
}

function filterQrCodes() {
  const query = (els.searchInput?.value || '').toLowerCase();
  const status = els.statusFilter?.value || 'all';

  const filtered = currentQrCodes.filter((qr) => {
    const matchQuery = (qr.title || '').toLowerCase().includes(query) ||
                       (qr.destination || '').toLowerCase().includes(query);
    const matchStatus = (status === 'all') ||
                        (status === 'active' && qr.active) ||
                        (status === 'inactive' && !qr.active);
    return matchQuery && matchStatus;
  });

  if (!filtered.length) {
    els.tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding: 2rem;">Nenhum QR Code encontrado com esses filtros.</td></tr>';
    return;
  }

  renderRows(els.tableBody, filtered, (qr) => {
    const isPix = /^000201/.test(qr.destination || '') && /br\.gov\.bcb\.pix/.test(qr.destination || '');
    const destDisplay = isPix ? 'PIX Payment' : truncate(qr.destination || '', 32);
    const statusClass = qr.active ? 'badge-active' : 'badge-inactive';
    const statusText = qr.active ? 'Ativo' : 'Pausado';
    
    return `
      <tr>
        <td>
          <div style="font-weight: 600; color: #1e293b;">${qr.title || 'Sem título'}</div>
          <div style="font-size: 0.75rem; color: #64748b;">${qr.publicId || ''}</div>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <i class="fas ${isPix ? 'fa-bolt' : 'fa-link'}" style="color:${isPix ? '#fbbf24' : '#94a3b8'}"></i>
            <span title="${qr.destination || ''}">${destDisplay}</span>
          </div>
        </td>
        <td>
            <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;" 
              data-action="preview" 
              data-public-id="${qr.publicId}"
              data-destination="${qr.destination || ''}"
              data-fixed-url="${qr.fixedUrl || ''}"
              data-color-dark="${qr.colorDark || '#000000'}"
              data-color-light="${qr.colorLight || '#FFFFFF'}"
              data-size="${qr.size || 320}"
            >
              <i class="fas fa-eye"></i> Visualizar
            </button>
        </td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
        <td>${formatDate(qr.createdAt)}</td>
        <td>
          <div class="actions">
            <button class="icon-button-sm" title="Editar" data-action="edit" data-id="${qr.id}"><i class="fas fa-edit"></i></button>
            <button class="icon-button-sm" title="Download" 
              data-action="download" 
              data-public-id="${qr.publicId}"
              data-destination="${qr.destination || ''}"
              data-fixed-url="${qr.fixedUrl || ''}"
              data-color-dark="${qr.colorDark || '#000000'}"
              data-color-light="${qr.colorLight || '#FFFFFF'}"
              data-size="${qr.size || 320}"
            ><i class="fas fa-download"></i></button>
            <button class="icon-button-sm" title="Excluir" data-action="delete" data-id="${qr.id}" data-title="${qr.title}"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  });
}

// Event Listeners for filter
els.searchInput?.addEventListener('input', filterQrCodes);
els.statusFilter?.addEventListener('change', filterQrCodes);
