import { observeAuth, logoutUser } from '../controllers/authController.js';
import { QRController, drawQRCode, downloadQRCode, drawQRCodeSvg, downloadQRCodeSvg } from '../controllers/qrController.js';
import { PricingModel } from '../models/pricingModel.js';
import { showAlert, toggleState, renderRows, formatDate } from '../views/ui.js';

console.log('Dashboard JS v2 loaded');

const PRIMARY_DOMAIN = 'https://qrcode-alugueja.netlify.app';
// Always use production domain for QR content, even on localhost
const BASE_URL = PRIMARY_DOMAIN; 
const composeQrUrl = (id) => `${PRIMARY_DOMAIN}/${id}`;

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
  
  // Views
  dashboardView: document.getElementById('dashboard-view'),
  newQrView: document.getElementById('new-qr-view'),
  btnNewQr: document.getElementById('btn-new-qr'),
  btnBackDashboard: document.getElementById('btn-back-dashboard'),
  btnBackDashboard2: document.getElementById('btn-back-dashboard-2'),
  
  // Form
  form: document.getElementById('qrForm'),
  submitBtn: document.getElementById('submitBtn'),
  preview: document.getElementById('qrPreview'),
  qrUrl: document.getElementById('qrUrl'),
  fixedUser: document.getElementById('fixedUser'),
  fixedSlug: document.getElementById('fixedSlug'),
  qrStyle: document.getElementById('qrStyle'),
  qrColor: document.getElementById('qrColor'),
  qrSize: document.getElementById('qrSize'),
  qrFormat: document.getElementById('qrFormat'),
  qrSvgWrap: document.getElementById('qrSvgWrap'),
  contentType: document.getElementById('contentType'),
  pixFields: document.getElementById('pixFields'),
  pixKey: document.getElementById('pixKey'),
  merchantName: document.getElementById('merchantName'),
  merchantCity: document.getElementById('merchantCity'),
  amount: document.getElementById('amount'),
  txid: document.getElementById('txid'),
  description: document.getElementById('description'),
  downloadBtn: document.getElementById('downloadBtn'),
  // Block Modal Elements
  blockModal: document.getElementById('blockModal'),
  closeBlockModal: document.getElementById('closeBlockModal'),
  okBlockModal: document.getElementById('okBlockModal')
};

// Block Modal Logic
const closeBlockModal = () => {
  els.blockModal.classList.add('hidden');
};
els.closeBlockModal?.addEventListener('click', closeBlockModal);
els.okBlockModal?.addEventListener('click', closeBlockModal);
els.blockModal?.addEventListener('click', (e) => {
  if (e.target === els.blockModal) closeBlockModal();
});

// Toggle Views
const showDashboard = () => {
  els.newQrView.classList.add('hidden');
  els.dashboardView.classList.remove('hidden');
  loadDashboard(); // Refresh data
};

const showNewQr = () => {
  selectedDocId = null; // Clear edit mode
  els.dashboardView.classList.add('hidden');
  els.newQrView.classList.remove('hidden');
  // Reset form
  els.form.reset();
  els.preview.classList.add('hidden');
  els.form.classList.remove('hidden');
  els.submitBtn.disabled = false;
  els.submitBtn.textContent = 'Criar QR Code';
  const headerTitle = els.newQrView.querySelector('.card-title');
  if (headerTitle) headerTitle.textContent = 'Novo QR Code';
  
  // Enable fixed ID fields
  if (els.fixedUser) els.fixedUser.disabled = false;
  if (els.fixedSlug) els.fixedSlug.disabled = false;

  // Trigger content type change to set visibility correct
  els.contentType.dispatchEvent(new Event('change'));
  // Calculate initial projected cost for new item
  updateProjectedCost();
};

els.btnNewQr?.addEventListener('click', () => {
  showNewQr();
});
// els.btnNewQr?.addEventListener('click', showNewQr);
els.btnBackDashboard?.addEventListener('click', showDashboard);
els.btnBackDashboard2?.addEventListener('click', showDashboard);

let selectedDocId = null;
let currentUserId = null;
let currentUserEmail = null; // Store for VIP check
let currentQRCodes = []; // Store locally for real-time pricing calculation
let isEditingPopulation = false; // Flag to prevent cost updates during edit population

// VIP Whitelist - Add emails here to bypass the block
const VIP_EMAILS = [
  'admin@example.com',
  'suporte@meuqrcode.com',
  'fernandoamerico2@gmail.com'
];

observeAuth((user) => {
  currentUserId = user?.uid || null;
  currentUserEmail = user?.email || null;
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
  loadDashboard();
}, () => window.location.replace('../login.html'));

// =========================================================
// Helpers from new.js (moved here for single-page experience)
// =========================================================
const toSlug = (value) =>
  (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');

const getContent = (value = '') => (value || '').trim();
const uniqueSuffix = () => (Date.now().toString(36) + Math.random().toString(36).slice(2, 4)).slice(-6);

function pad(n) { return n.toString().padStart(2, '0'); }
function tlv(id, value) { const v = String(value || ''); return id + pad(v.length) + v; }
function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function buildPixPayload({ pixKey, merchantName, merchantCity, amount, txid, description }) {
  const sanitizeText = (s = '', max = 25) => {
    const t = (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().replace(/[^A-Z0-9 \-\.]/g, ' ').trim();
    return t.slice(0, max);
  };
  const sanitizeTxid = (s = '') => (s || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 25);
  const nmSan = sanitizeText(merchantName, 25);
  const citySan = sanitizeText(merchantCity, 15);
  const descSan = (description || '').toString().slice(0, 40);
  const txidSan = sanitizeTxid(txid);

  const acc = tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', pixKey) + (descSan ? tlv('02', descSan) : ''));
  const mcc = tlv('52', '0000');
  const cur = tlv('53', '986');
  const amt = amount ? tlv('54', String(parseFloat(amount).toFixed(2))) : '';
  const cty = tlv('58', 'BR');
  const nm = tlv('59', nmSan);
  const city = tlv('60', citySan);
  const add = txidSan ? tlv('62', tlv('05', txidSan)) : '';
  const base = tlv('00', '01') + tlv('01', '11') + acc + mcc + cur + amt + cty + nm + city + add + '6304';
  const crc = crc16(base);
  return base + crc;
}

function drawStyledQR(value, style = 'default', format = 'png', size = 320) {
  const optionsByStyle = {
    default: { color: { dark: '#050814', light: '#FFFFFF' } },
    dark: { color: { dark: '#000000', light: '#FFFFFF' } },
    light: { color: { dark: '#333333', light: '#FAFAFA' } },
    blue: { color: { dark: '#1f4ed8', light: '#FFFFFF' } }
  };
  
  let opts;
  if (style && style.startsWith('#')) {
    opts = { color: { dark: style, light: '#FFFFFF' } };
  } else {
    opts = optionsByStyle[style] || optionsByStyle.default;
  }

  // Add width option
  opts.width = parseInt(size) || 320;

  if (format === 'svg') {
    return drawQRCodeSvg('qrSvgWrap', value, opts).then(() => {
      if (els.qrSvgWrap) els.qrSvgWrap.style.display = 'block';
      if (els.qrPreviewCanvas) els.qrPreviewCanvas.style.display = 'none';
    });
  }
  if (els.qrSvgWrap) els.qrSvgWrap.style.display = 'none';
  if (els.qrPreviewCanvas) els.qrPreviewCanvas.style.display = 'block';
  return drawQRCode('qrCanvas', value, opts);
}

// =========================================================
// Form Logic (New QR)
// =========================================================
els.form?.addEventListener('submit', async (event) => {
  event.preventDefault();

  // Check cost and block if > 0 and not VIP (on Submit)
  const isCustomForBlock = els.qrStyle.value === 'custom';
  const styleValForBlock = isCustomForBlock ? (els.qrColor?.value || '#000000') : (els.qrStyle?.value || 'default');
  const sizeValForBlock = els.qrSize?.value || 200;
  
  const formQRForBlock = {
      docId: selectedDocId || 'temp-new',
      active: els.form.active.checked,
      style: styleValForBlock,
      size: sizeValForBlock
  };

  let projectedListForBlock;
  if (selectedDocId) {
      projectedListForBlock = currentQRCodes.map(qr => qr.docId === selectedDocId ? { ...qr, ...formQRForBlock } : qr);
  } else {
      projectedListForBlock = [...currentQRCodes, formQRForBlock];
  }

  const pricingForBlock = PricingModel.calculateMonthlyCost(projectedListForBlock);
  if (pricingForBlock.total > 0) {
      const isVip = VIP_EMAILS.includes(currentUserEmail);
      if (!isVip) {
          if (els.blockModal) {
            els.blockModal.classList.remove('hidden');
          }
          return; // Stop submission
      }
  }

  const title = els.form.title.value;
  const isPix = els.contentType?.value === 'pix';
  const destination = isPix ? '' : getContent(els.form.destination.value);
  const active = els.form.active.checked;
  
  if (!destination && !isPix) {
    showAlert(els.alert, 'Informe o conteúdo do QR (texto, link, pix, email, etc.).', 'error');
    return;
  }
  if (isPix) {
    if (!els.pixKey?.value || !els.merchantName?.value || !els.merchantCity?.value) {
       showAlert(els.alert, 'Preencha chave, nome e cidade para PIX.', 'error');
       return;
    }
  }

  // ID Logic only for CREATE
  let fixedId = null;
  let fixedUrlForSave = null;

  if (!selectedDocId) {
    const userPartRaw = toSlug(els.fixedUser?.value) || 'meus-servicos';
    const rawSlug = els.fixedSlug?.value || '';
    const isUrlLike = /^https?:/i.test(rawSlug) || rawSlug.includes('.');
    const slugPartRaw = isUrlLike ? '' : toSlug(rawSlug);
    const userPart = userPartRaw.replace(/-/g, '');
    fixedId = slugPartRaw ? slugPartRaw : `${userPart}${uniqueSuffix()}`;
    fixedUrlForSave = `${PRIMARY_DOMAIN}/${fixedId}`;
  }

  els.submitBtn.disabled = true;
  els.submitBtn.innerHTML = '<span class="loading"></span> Carregando...';

  try {
    const pixDataObj = isPix ? {
      pixKey: els.pixKey.value,
      merchantName: els.merchantName.value,
      merchantCity: els.merchantCity.value,
      amount: els.amount.value,
      txid: els.txid.value,
      description: els.description.value
    } : null;

    const destinationToSave = isPix ? buildPixPayload(pixDataObj) : destination;
    
    const isCustom = els.qrStyle.value === 'custom';
    if (els.qrColor) {
       els.qrColor.classList[isCustom ? 'remove' : 'add']('hidden');
    }
    const styleVal = isCustom ? (els.qrColor?.value || '#000000') : (els.qrStyle?.value || 'default');
    const sizeVal = els.qrSize?.value || 200;

    let resultItem;
    if (selectedDocId) {
        // UPDATE
        await QRController.update(selectedDocId, {
            title,
            destination: destinationToSave,
            active,
            ownerId: currentUserId,
            style: styleVal,
            size: sizeVal,
            pixData: pixDataObj
        });
        // Retrieve updated item to show preview correctly
        resultItem = await QRController.find(selectedDocId);
        showAlert(els.alert, 'QR Code atualizado com sucesso!', 'success');
    } else {
        // CREATE
        resultItem = await QRController.create({ 
            title, 
            destination: destinationToSave, 
            active, 
            id: fixedId, 
            fixedUrl: fixedUrlForSave, 
            ownerId: currentUserId,
            style: styleVal,
            size: sizeVal,
            pixData: pixDataObj
        });
        showAlert(els.alert, 'QR Code criado com sucesso!', 'success');
    }
    
    const displayUrl = (BASE_URL === window.location.origin)
      ? composeQrUrl(resultItem.id)
      : (resultItem.fixedUrl || composeQrUrl(resultItem.id));
      
    const format = (els.qrFormat?.value || 'png');
    // Use the saved destination as the value for QR (PIX payload or URL)
    const valueForQr = isPix ? destinationToSave : (resultItem.fixedUrl || composeQrUrl(resultItem.id));
    
    if (els.qrUrl) els.qrUrl.textContent = isPix ? destinationToSave : displayUrl;
    await drawStyledQR(valueForQr, styleVal, format, sizeVal);
    
    els.preview.classList.remove('hidden');
    els.form.classList.add('hidden');
    
    // Refresh dashboard cost (since real-time was removed, we update on save)
    loadDashboard();
    
  } catch (error) {
    showAlert(els.alert, 'Erro ao salvar QR Code.', 'error');
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = selectedDocId ? 'Salvar Alterações' : 'Criar QR Code';
    console.error(error);
  }
});

els.contentType?.addEventListener('change', () => {
  const isPix = els.contentType.value === 'pix';
  if (els.pixFields) els.pixFields.classList[isPix ? 'remove' : 'add']('hidden');
  const destGroup = document.getElementById('destinationGroup');
  if (destGroup) destGroup.classList[isPix ? 'add' : 'remove']('hidden');
  const destInput = document.getElementById('destination');
  if (destInput) destInput.required = !isPix;
});

els.downloadBtn?.addEventListener('click', () => {
  const format = (els.qrFormat?.value || 'png');
  const filenameBase = (els.form.title.value || 'qrcode').replace(/\s+/g, '-').toLowerCase();
  if (format === 'svg') {
    downloadQRCodeSvg('qrSvgWrap', `${filenameBase}.svg`);
  } else {
    downloadQRCode('qrCanvas', `${filenameBase}.png`);
  }
});

// Listener for Style Change
els.qrStyle?.addEventListener('change', () => {
  const isCustom = els.qrStyle.value === 'custom';
  if (els.qrColor) {
     els.qrColor.classList[isCustom ? 'remove' : 'add']('hidden');
  }
  // Force update when switching style type
  updateProjectedCost();
});
// Listener for Color Change (optional real-time preview if we had one, but we don't have live preview in form yet)
// We could add it if we want, but currently preview is generated on submit.


const logoutBtn = document.getElementById('logoutBtnSidebar') || document.getElementById('logoutBtn');
logoutBtn?.addEventListener('click', async () => {
  await logoutUser();
  window.location.replace('../login.html');
});

const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebar = document.querySelector('.sidebar');
if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 900 && 
            sidebar.classList.contains('active') && 
            !sidebar.contains(e.target) && 
            !mobileMenuBtn.contains(e.target)) {
            sidebar.classList.remove('active');
        }
    });
}

const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const mainContent = document.querySelector('.main-content');
if (toggleSidebarBtn && sidebar && mainContent) {
    toggleSidebarBtn.addEventListener('click', (e) => {
        // Prevent event bubbling so it doesn't trigger navigation if inside an anchor (though it's a button now)
        e.stopPropagation(); 
        
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
        
        // Save preference
        const isCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebarState', isCollapsed ? 'collapsed' : 'expanded');
    });
}

// Real-time pricing update
function updateProjectedCost() {
  if (isEditingPopulation) return;
  if (!currentQRCodes) return;

  const isActive = els.form.active.checked;
  const isCustom = els.qrStyle.value === 'custom';
  const styleVal = isCustom ? (els.qrColor?.value || '#000000') : (els.qrStyle?.value || 'default');
  const sizeVal = els.qrSize?.value || 200;

  const formQR = {
      docId: selectedDocId || 'temp-new',
      active: isActive,
      style: styleVal,
      size: sizeVal
  };

  let projectedList;
  if (selectedDocId) {
      // Edit mode: replace the existing item in the list
      projectedList = currentQRCodes.map(qr => qr.docId === selectedDocId ? { ...qr, ...formQR } : qr);
  } else {
      // New mode: add to the list
      projectedList = [...currentQRCodes, formQR];
  }

  updatePricingUI(projectedList);
}

// Add listeners for real-time cost updates
els.form.active?.addEventListener('change', updateProjectedCost);
els.qrStyle?.addEventListener('change', updateProjectedCost);
els.qrColor?.addEventListener('input', updateProjectedCost);
els.qrColor?.addEventListener('change', updateProjectedCost); // Ensure update on commit
els.qrSize?.addEventListener('change', updateProjectedCost);

// Restore sidebar state on load
const savedSidebarState = localStorage.getItem('sidebarState');
if (savedSidebarState === 'collapsed' && sidebar && mainContent) {
    sidebar.classList.add('collapsed');
    mainContent.classList.add('expanded');
}

els.tableBody?.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const docId = target.dataset.id;
  const title = target.dataset.title;
  const destination = target.dataset.destination;
  const publicId = target.dataset.publicId;

  if (target.dataset.action === 'edit') {
    const item = await QRController.find(docId);
    if (!item) {
        showAlert(els.alert, 'Item não encontrado para edição.', 'error');
        return;
    }

    selectedDocId = docId;
    showNewQr();
    isEditingPopulation = true;
    
    // Update header title
    const headerTitle = els.newQrView.querySelector('.card-title');
    if (headerTitle) headerTitle.textContent = 'Editar QR Code';
    els.submitBtn.textContent = 'Salvar Alterações';

    // Populate fields
    if (els.form.title) els.form.title.value = item.title || '';
    if (els.form.active) els.form.active.checked = !!item.active;
    
    const dest = item.destination || '';
    const isPix = /^000201/.test(dest) && /br\.gov\.bcb\.pix/.test(dest);
    
    if (els.contentType) {
      els.contentType.value = isPix ? 'pix' : 'text';
      els.contentType.dispatchEvent(new Event('change'));
    }

    if (isPix) {
        if (item.pixData) {
            if (els.pixKey) els.pixKey.value = item.pixData.pixKey || '';
            if (els.merchantName) els.merchantName.value = item.pixData.merchantName || '';
            if (els.merchantCity) els.merchantCity.value = item.pixData.merchantCity || '';
            if (els.amount) els.amount.value = item.pixData.amount || '';
            if (els.txid) els.txid.value = item.pixData.txid || '';
            if (els.description) els.description.value = item.pixData.description || '';
        }
    } else {
       if (els.form.destination) els.form.destination.value = dest;
    }

    // Populate Style
    let styleVal = 'default';
    if (els.qrStyle) {
      const savedStyle = item.style || 'default';
      styleVal = savedStyle;
      if (savedStyle.startsWith('#')) {
         els.qrStyle.value = 'custom';
         if (els.qrColor) {
             els.qrColor.value = savedStyle;
             els.qrColor.classList.remove('hidden');
         }
      } else {
         els.qrStyle.value = savedStyle;
         if (els.qrColor) els.qrColor.classList.add('hidden');
    }
    els.qrStyle.dispatchEvent(new Event('change'));
  }
  
  // Populate Size
  if (els.qrSize) {
      els.qrSize.value = item.size || 200;
  }
  
  // Fixed URL Fields (Disable/Populate)
  if (els.fixedUser) els.fixedUser.disabled = true;
  if (els.fixedSlug) {
      els.fixedSlug.disabled = true;
      els.fixedSlug.value = item.id || '';
  }

  // DRAW PREVIEW IMMEDIATELY
  const displayUrl = (BASE_URL === window.location.origin)
    ? composeQrUrl(item.id)
    : (item.fixedUrl || composeQrUrl(item.id));
  
  // Determine the value to draw (PIX payload or URL)
  const valueForQr = isPix ? dest : (item.fixedUrl || composeQrUrl(item.id));

  if (els.qrUrl) els.qrUrl.textContent = isPix ? dest : displayUrl;
  
  // Draw
  const format = (els.qrFormat?.value || 'png');
  const sizeVal = item.size || 200;
  await drawStyledQR(valueForQr, styleVal, format, sizeVal);
  els.preview.classList.remove('hidden');

  // Trigger real-time update (re-implemented as requested for immediate feedback)
  // updateProjectedCost(); // Removed as per user request to NOT update on edit start

  isEditingPopulation = false;
  return;
}

  if (target.dataset.action === 'delete') {
    selectedDocId = docId;
    document.getElementById('modalMessage').innerHTML = `Tem certeza que deseja excluir <strong>${title || 'este QR Code'}</strong>?`;
    toggleState(els.deleteModal, true);
  }

  if (target.dataset.action === 'preview') {
    if (!publicId) return;
    const fixedUrl = target.dataset.fixedUrl;
    const dest = target.dataset.destination || '';
    const style = target.dataset.style || 'default';
    const isPix = /^000201/.test(dest) && /br\.gov\.bcb\.pix/.test(dest);
    const qrValue = isPix
      ? dest
      : ((BASE_URL === window.location.origin) ? composeQrUrl(publicId) : (fixedUrl || composeQrUrl(publicId)));
    els.qrPreviewUrl.textContent = qrValue;
    toggleState(els.qrPreviewModal, true);
    // Prepare options manually to target qrPreviewCanvas
    const optionsByStyle = {
        default: { color: { dark: '#050814', light: '#FFFFFF' } },
        dark: { color: { dark: '#000000', light: '#FFFFFF' } },
        light: { color: { dark: '#333333', light: '#FAFAFA' } },
        blue: { color: { dark: '#1f4ed8', light: '#FFFFFF' } }
    };
    let opts;
    if (style && style.startsWith('#')) {
        opts = { color: { dark: style, light: '#FFFFFF' } };
    } else {
        opts = optionsByStyle[style] || optionsByStyle.default;
    }
    
    drawQRCode('qrPreviewCanvas', qrValue, opts).catch(console.error);
  }

  if (target.dataset.action === 'download') {
    if (!publicId) return;
    const fixedUrl = target.dataset.fixedUrl;
    const dest = target.dataset.destination || '';
    const style = target.dataset.style || 'default';
    const isPix = /^000201/.test(dest) && /br\.gov\.bcb\.pix/.test(dest);
    const qrValue = isPix
      ? dest
      : ((BASE_URL === window.location.origin) ? composeQrUrl(publicId) : (fixedUrl || composeQrUrl(publicId)));
    const filename = `${(title || 'qrcode').replace(/\s+/g, '-').toLowerCase()}-${publicId}.png`;
    
    // Style logic again
    const optionsByStyle = {
        default: { color: { dark: '#050814', light: '#FFFFFF' } },
        dark: { color: { dark: '#000000', light: '#FFFFFF' } },
        light: { color: { dark: '#333333', light: '#FAFAFA' } },
        blue: { color: { dark: '#1f4ed8', light: '#FFFFFF' } }
    };
    let opts;
    if (style && style.startsWith('#')) {
        opts = { color: { dark: style, light: '#FFFFFF' } };
    } else {
        opts = optionsByStyle[style] || optionsByStyle.default;
    }

    drawQRCode('qrPreviewCanvas', qrValue, opts)
      .then(() => downloadQRCode('qrPreviewCanvas', filename))
      .catch(console.error);
  }

  if (target.dataset.action === 'print') {
    if (!publicId) return;
    const fixedUrl = target.dataset.fixedUrl;
    const dest = target.dataset.destination || '';
    const style = target.dataset.style || 'default';
    const isPix = /^000201/.test(dest) && /br\.gov\.bcb\.pix/.test(dest);
    const qrValue = isPix
      ? dest
      : ((BASE_URL === window.location.origin) ? composeQrUrl(publicId) : (fixedUrl || composeQrUrl(publicId)));
      
    // Style logic again
    const optionsByStyle = {
        default: { color: { dark: '#050814', light: '#FFFFFF' } },
        dark: { color: { dark: '#000000', light: '#FFFFFF' } },
        light: { color: { dark: '#333333', light: '#FAFAFA' } },
        blue: { color: { dark: '#1f4ed8', light: '#FFFFFF' } }
    };
    let opts;
    if (style && style.startsWith('#')) {
        opts = { color: { dark: style, light: '#FFFFFF' } };
    } else {
        opts = optionsByStyle[style] || optionsByStyle.default;
    }

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
  els.confirmDelete.innerHTML = '<span class="loading" style="width:16px;height:16px;border-width:2px;"></span> Excluindo...';
  try {
    await QRController.remove(selectedDocId);
    showAlert(els.alert, 'QR Code excluído.', 'success');
    toggleState(els.deleteModal, false);
    await loadDashboard();
  } catch (error) {
    showAlert(els.alert, 'Erro ao excluir QR Code.', 'error');
  } finally {
    selectedDocId = null;
    els.confirmDelete.disabled = false;
    els.confirmDelete.textContent = 'Excluir';
  }
});

els.cancelDelete?.addEventListener('click', () => toggleState(els.deleteModal, false));
document.getElementById('closeDeleteModal')?.addEventListener('click', () => toggleState(els.deleteModal, false));
document.getElementById('closeQrPreview')?.addEventListener('click', () => toggleState(els.qrPreviewModal, false));

async function loadDashboard() {
  try {
    toggleState(els.loading, true);

    const planCostEl = document.getElementById('planCost');
    if (planCostEl) {
      planCostEl.innerHTML = '<span class="loading" style="width:14px;height:14px;border-width:2px;margin-right:6px;"></span> Calculando...';
    }

    const qrCodes = currentUserId ? await QRController.mine(currentUserId) : [];
    currentQRCodes = qrCodes; // Update local store
    toggleState(els.loading, false);

    if (!qrCodes.length) {
      try { updatePricingUI([]); } catch(e) { console.error('Pricing Error:', e); }
      toggleState(els.emptyState, true);
      toggleState(els.tableWrap, false);
      return;
    }

    try { updatePricingUI(qrCodes); } catch(e) { console.error('Pricing Error:', e); }
    toggleState(els.emptyState, false);
    toggleState(els.tableWrap, true);

    renderRows(els.tableBody, qrCodes, (qr) => `
      <tr>
        <td>${qr.title || 'Sem título'}</td>
        <td class="col-destination"><a href="${qr.destination}" target="_blank">${truncate(qr.destination)}</a></td>
        <td class="col-qr">
          <button class="icon-button" title="Ver QR Code" data-action="preview" data-id="${qr.docId}" data-title="${qr.title}" data-destination="${qr.destination}" data-public-id="${qr.id}" data-fixed-url="${qr.fixedUrl || ''}" data-style="${qr.style || 'default'}">
            <i class="fas fa-eye"></i>
          </button>
        </td>
        <td><span class="badge ${qr.active ? 'badge-active' : 'badge-inactive'}">${qr.active ? 'Ativo' : 'Inativo'}</span></td>
        <td class="col-actions">
          <div class="actions">
            <button class="icon-button" title="Editar" data-action="edit" data-id="${qr.docId}" data-title="${qr.title}">
              <i class="fas fa-edit"></i>
            </button>
            <button class="icon-button" title="Baixar QR Code" data-action="download" data-id="${qr.docId}" data-title="${qr.title}" data-public-id="${qr.id}" data-fixed-url="${qr.fixedUrl || ''}" data-style="${qr.style || 'default'}">
              <i class="fas fa-download"></i>
            </button>
            <button class="icon-button" title="Imprimir QR Code" data-action="print" data-id="${qr.docId}" data-title="${qr.title}" data-public-id="${qr.id}" data-fixed-url="${qr.fixedUrl || ''}" data-style="${qr.style || 'default'}">
              <i class="fas fa-print"></i>
            </button>
            <button class="icon-button" title="Excluir" data-action="delete" data-id="${qr.docId}" data-title="${qr.title}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `);
  } catch (error) {
    toggleState(els.loading, false);
    showAlert(els.alert, 'Erro ao carregar QR Codes.', 'error');
    console.error(error);
  }
}

function truncate(text = '', size = 48) {
  return text.length > size ? `${text.substring(0, size)}…` : text;
}

function updatePricingUI(qrCodes) {
  const pricing = PricingModel.calculateMonthlyCost(qrCodes);
  const planCostEl = document.getElementById('planCost');
  if (planCostEl) {
      planCostEl.innerHTML = `
          <i class="fas fa-calculator"></i>
          <span>${pricing.formattedTotal} / mês</span>
      `;
      planCostEl.title = `Plano: ${pricing.breakdown.activeQRs} ativos (${pricing.breakdown.extraQRs} extras), ${pricing.breakdown.paidColors} cores pagas.`;
  }
}
