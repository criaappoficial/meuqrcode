import { observeAuth, logoutUser } from '../controllers/authController.js';
import { QRController, drawQRCode, downloadQRCode } from '../controllers/qrController.js';
import { showAlert } from '../views/ui.js';

const PRIMARY_DOMAIN = 'https://qrcode-alugueja.netlify.app';
const BASE_URL = (['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)) ? window.location.origin : PRIMARY_DOMAIN;

const params = new URLSearchParams(window.location.search);
const docId = params.get('id');

const els = {
  form: document.getElementById('qrForm'),
  alert: document.getElementById('alert-container'),
  loading: document.getElementById('loading'),
  contentType: document.getElementById('contentType'),
  
  // PIX Fields
  pixFields: document.getElementById('pixFields'),
  pixKey: document.getElementById('pixKey'),
  merchantName: document.getElementById('merchantName'),
  merchantCity: document.getElementById('merchantCity'),
  amount: document.getElementById('amount'),
  txid: document.getElementById('txid'),
  description: document.getElementById('description'),
  
  // Visual
  colorDark: document.getElementById('colorDark'),
  colorLight: document.getElementById('colorLight'),
  qrSize: document.getElementById('qrSize'),
  
  // Preview
  preview: document.getElementById('qrPreview'),
  qrUrl: document.getElementById('qrUrl'),
  qrCanvas: document.getElementById('qrCanvas'),
  downloadBtn: document.getElementById('downloadBtn'),
  
  // Sidebar & Layout elements
  sidebarToggle: document.getElementById('sidebarToggle'),
  sidebarClose: document.getElementById('sidebarClose'),
  sidebarOverlay: document.getElementById('sidebarOverlay'),
  sidebar: document.querySelector('.sidebar'),
  logoutBtn: document.getElementById('logoutBtn'),
  userEmailDisplay: document.getElementById('userEmailDisplay')
};

let currentRecord = null;
if (!docId) window.location.replace('dashboard.html');

let currentUserId = null;
observeAuth((user) => { 
  currentUserId = user?.uid || null;
  
  // Update User UI
  if (els.userEmailDisplay) els.userEmailDisplay.textContent = user?.email || 'Usuário';
  
  init(); 
}, () => window.location.replace('../login.html'));

// Sidebar Logic
els.sidebarToggle?.addEventListener('click', () => {
  els.sidebar.classList.add('active');
  els.sidebarOverlay.classList.add('active');
});

const closeSidebar = () => {
  els.sidebar.classList.remove('active');
  els.sidebarOverlay.classList.remove('active');
};

els.sidebarClose?.addEventListener('click', closeSidebar);
els.sidebarOverlay?.addEventListener('click', closeSidebar);

// Logout Logic
els.logoutBtn?.addEventListener('click', async () => {
  try {
    await logoutUser();
    window.location.replace('../login.html');
  } catch (error) {
    console.error('Logout error:', error);
    showAlert(els.alert, 'Erro ao sair.', 'error');
  }
});

// Helper Functions
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

function parsePix(payload) {
  const result = { pixKey: '', amount: '', merchantName: '', merchantCity: '', txid: '', description: '' };
  try {
    let i = 0;
    while (i < payload.length) {
      const id = payload.slice(i, i + 2);
      const lenStr = payload.slice(i + 2, i + 4);
      if (!lenStr) break;
      const len = parseInt(lenStr, 10);
      const val = payload.slice(i + 4, i + 4 + len);
      i += 4 + len;

      if (id === '26') {
        // Merchant Account Info
        let j = 0;
        while (j < val.length) {
          const subId = val.slice(j, j + 2);
          const subLen = parseInt(val.slice(j + 2, j + 4), 10);
          const subVal = val.slice(j + 4, j + 4 + subLen);
          j += 4 + subLen;
          if (subId === '01') result.pixKey = subVal;
          if (subId === '02') result.description = subVal;
        }
      }
      if (id === '54') result.amount = val;
      if (id === '59') result.merchantName = val;
      if (id === '60') result.merchantCity = val;
      if (id === '62') {
         let k = 0;
         while (k < val.length) {
            const subId = val.slice(k, k+2);
            const subLen = parseInt(val.slice(k+2, k+4), 10);
            const subVal = val.slice(k+4, k+4+subLen);
            k += 4 + subLen;
            if (subId === '05') result.txid = subVal;
         }
      }
    }
  } catch (e) {
    console.error('Error parsing PIX', e);
  }
  return result;
}

async function init() {
  try {
    const data = await QRController.find(docId);
    if (!data) {
      showAlert(els.alert, 'QR Code não encontrado.', 'error');
      setTimeout(() => window.location.replace('dashboard.html'), 1500);
      return;
    }
    if (data.ownerId && currentUserId && data.ownerId !== currentUserId) {
      showAlert(els.alert, 'Você não tem permissão para editar este QR Code.', 'error');
      setTimeout(() => window.location.replace('dashboard.html'), 1500);
      return;
    }
    if (!data.ownerId && currentUserId) {
      await QRController.update(docId, { ownerId: currentUserId });
      data.ownerId = currentUserId;
    }
    currentRecord = data;
    els.form.title.value = data.title;
    els.form.destination.value = data.destination;
    els.form.active.checked = data.active !== false;
    const dest = (data.destination || '').trim();
    const isPix = /^000201/.test(dest) && /br\.gov\.bcb\.pix/.test(dest);
    
    if (isPix) {
      els.contentType.value = 'pix';
      setupPixFields(true, dest);
    } else {
      els.contentType.value = 'text';
      setupPixFields(false);
    }

    if (els.colorDark) els.colorDark.value = data.colorDark || '#000000';
    if (els.colorLight) els.colorLight.value = data.colorLight || '#FFFFFF';
    if (els.qrSize) els.qrSize.value = data.size || 320;
    
    els.loading.classList.add('hidden');
    els.form.classList.remove('hidden');
    
    // Draw initial preview
    updatePreview(data.destination, data.colorDark, data.colorLight, data.size);
    
  } catch (error) {
    showAlert(els.alert, 'Erro ao carregar QR Code.', 'error');
    console.error(error);
  }
}

function setupPixFields(isPix, destinationValue = '') {
  if (isPix) {
    els.pixFields.classList.remove('hidden');
    const destInput = document.getElementById('destination');
    const destGroup = document.querySelector('#destination').parentElement;
    
    // Hide standard destination field in PIX mode as it's generated
    destGroup.classList.add('hidden');
    destInput.required = false;

    if (destinationValue) {
      const parsed = parsePix(destinationValue);
      els.pixKey.value = parsed.pixKey || '';
      els.amount.value = parsed.amount || '';
      els.merchantName.value = parsed.merchantName || '';
      els.merchantCity.value = parsed.merchantCity || '';
      els.txid.value = parsed.txid || '';
      els.description.value = parsed.description || '';
    }
  } else {
    els.pixFields.classList.add('hidden');
    const destInput = document.getElementById('destination');
    const destGroup = document.querySelector('#destination').parentElement;
    
    destGroup.classList.remove('hidden');
    destInput.required = true;
    destInput.placeholder = 'https://...';
  }
}

els.contentType.addEventListener('change', () => {
  const isPix = els.contentType.value === 'pix';
  if (isPix) {
    els.pixFields.classList.remove('hidden');
    document.querySelector('#destination').parentElement.classList.add('hidden');
    document.getElementById('destination').required = false;
  } else {
    els.pixFields.classList.add('hidden');
    document.querySelector('#destination').parentElement.classList.remove('hidden');
    document.getElementById('destination').required = true;
  }
});

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const title = els.form.title.value;
  const isPix = els.contentType.value === 'pix';
  let destination = els.form.destination.value;
  const active = els.form.active.checked;
  const colorDark = els.colorDark.value;
  const colorLight = els.colorLight.value;
  const size = parseInt(els.qrSize.value, 10);
  
  if (isPix) {
    if (!els.pixKey.value || !els.merchantName.value || !els.merchantCity.value) {
      showAlert(els.alert, 'Preencha Chave PIX, Nome e Cidade.', 'error');
      return;
    }
    
    destination = buildPixPayload({
      pixKey: els.pixKey.value,
      merchantName: els.merchantName.value,
      merchantCity: els.merchantCity.value,
      amount: els.amount.value,
      txid: els.txid.value,
      description: els.description.value
    });
  } else {
    if (!destination) {
      showAlert(els.alert, 'Informe o destino.', 'error');
      return;
    }
  }
  
  try {
    await QRController.update(docId, {
      title,
      destination,
      active,
      colorDark,
      colorLight,
      size
    });
    
    updatePreview(destination, colorDark, colorLight, size);
    showAlert(els.alert, 'QR Code atualizado com sucesso!', 'success');
    els.preview.classList.remove('hidden');
    els.form.classList.add('hidden');
    
  } catch (error) {
    console.error(error);
    showAlert(els.alert, 'Erro ao atualizar.', 'error');
  }
});

function updatePreview(text, colorDark, colorLight, size) {
  const opts = {
    width: size || 320,
    color: {
      dark: colorDark || '#000000',
      light: colorLight || '#FFFFFF'
    }
  };
  
  els.qrUrl.textContent = text;
  drawQRCode('qrCanvas', text, opts);
}

els.downloadBtn?.addEventListener('click', () => {
  const filename = (els.form.title.value || 'qrcode').replace(/\s+/g, '-').toLowerCase();
  downloadQRCode('qrCanvas', `${filename}.png`);
});
