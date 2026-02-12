import { observeAuth, logoutUser } from '../controllers/authController.js';
import { QRController, drawQRCode, downloadQRCode } from '../controllers/qrController.js';
import { showAlert } from '../views/ui.js';

const PRIMARY_DOMAIN = 'https://qrcode-alugueja.netlify.app';
const BASE_URL = (['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)) ? window.location.origin : PRIMARY_DOMAIN;
const composeQrUrl = (id) => (BASE_URL === window.location.origin)
  ? `${window.location.origin}/page/index.html?id=${id}`
  : `${PRIMARY_DOMAIN}/${id}`;

const getContent = (value = '') => (value || '').trim();

const params = new URLSearchParams(window.location.search);
const docId = params.get('id');

const els = {
  form: document.getElementById('qrForm'),
  alert: document.getElementById('alert-container'),
  loading: document.getElementById('loading'),
  preview: document.getElementById('qrPreview'),
  qrUrl: document.getElementById('qrUrl'),
  submit: document.getElementById('submitBtn'),
  contentType: document.getElementById('contentType'),
  pixFields: document.getElementById('pixFields'),
  pixKey: document.getElementById('pixKey'),
  amount: document.getElementById('amount')
};

let currentRecord = null;
if (!docId) window.location.replace('dashboard.html');

let currentUserId = null;
observeAuth((user) => { currentUserId = user?.uid || null; init(); }, () => window.location.replace('../login.html'));

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
      els.pixFields.classList.remove('hidden');
      const destInput = document.getElementById('destination');
      const destGroup = document.querySelector('#destination').parentElement;
      destInput.required = true;
      destGroup.classList.remove('hidden');
      const destLabel = destGroup.querySelector('label');
      if (destLabel) destLabel.textContent = 'Chave PIX *';
      destInput.placeholder = 'EVP, e-mail, telefone, CPF/CNPJ';
      const parsed = parsePix(dest);
      // usar o campo Destino como chave PIX para evitar confusão
      els.form.destination.value = parsed.pixKey || '';
      // esconder campo específico de chave PIX
      const pixKeyGroup = document.getElementById('pixKey')?.parentElement;
      if (pixKeyGroup) pixKeyGroup.classList.add('hidden');
      els.amount.value = parsed.amount || '';
    } else {
      els.contentType.value = 'text';
      els.pixFields.classList.add('hidden');
      const destInput = document.getElementById('destination');
      const destGroup = document.querySelector('#destination').parentElement;
      destInput.required = true;
      destGroup.classList.remove('hidden');
      const destLabel = destGroup.querySelector('label');
      if (destLabel) destLabel.textContent = 'Destino *';
      destInput.placeholder = '';
      const pixKeyGroup = document.getElementById('pixKey')?.parentElement;
      if (pixKeyGroup) pixKeyGroup.classList.remove('hidden');
    }
    els.loading.classList.add('hidden');
    els.form.classList.remove('hidden');
  } catch (error) {
    showAlert(els.alert, 'Erro ao carregar QR Code.', 'error');
    console.error(error);
  }
}

els.form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const isPix = els.contentType?.value === 'pix';
  let destination = getContent(els.form.destination.value);
  if (isPix) {
    const current = parsePix((currentRecord?.destination || '').trim());
    const newPayload = buildPixPayload({
      pixKey: destination || current.pixKey || '',
      merchantName: current.merchantName || 'RECEBEDOR',
      merchantCity: current.merchantCity || 'CIDADE',
      amount: els.amount.value || current.amount || '',
      txid: current.txid || '',
      description: current.description || ''
    });
    destination = newPayload;
  }
  const payload = { title: els.form.title.value, destination, active: els.form.active.checked };
  if (!payload.destination) {
    showAlert(els.alert, 'Informe o conteúdo do QR (texto, link, pix, email, etc.).', 'error');
    return;
  }

  els.submit.disabled = true;
  els.submit.innerHTML = '<span class="loading"></span> Salvando...';

  try {
    await QRController.update(docId, payload);
    const displayUrl = (BASE_URL === window.location.origin)
      ? composeQrUrl(currentRecord.id)
      : (currentRecord.fixedUrl || composeQrUrl(currentRecord.id));
    const dest = payload.destination || '';
    const isPixPayload = /^000201/.test(dest) && /br\.gov\.bcb\.pix/.test(dest);
    const valueForQr = isPixPayload ? dest : (currentRecord.fixedUrl || composeQrUrl(currentRecord.id));
    els.qrUrl.textContent = isPixPayload ? dest : displayUrl;
    await drawQRCode('qrCanvas', valueForQr);
    els.preview.classList.remove('hidden');
    els.form.classList.add('hidden');
    showAlert(els.alert, 'QR Code atualizado!', 'success');
  } catch (error) {
    showAlert(els.alert, 'Erro ao salvar QR Code.', 'error');
    els.submit.disabled = false;
    els.submit.textContent = 'Salvar Alterações';
    console.error(error);
  }
});

const downloadBtn = document.getElementById('downloadBtn');
downloadBtn?.addEventListener('click', () => {
  const filename = `${(els.form.title.value || 'qrcode').replace(/\s+/g, '-').toLowerCase()}.png`;
  downloadQRCode('qrCanvas', filename);
});
els.contentType?.addEventListener('change', () => {
  const isPix = els.contentType.value === 'pix';
  els.pixFields.classList[isPix ? 'remove' : 'add']('hidden');
  const destInput = document.getElementById('destination');
  destInput.required = true;
  const destGroup = destInput.parentElement;
  destGroup.classList.remove('hidden');
  const destLabel = destGroup.querySelector('label');
  if (isPix) {
    if (destLabel) destLabel.textContent = 'Chave PIX *';
    destInput.placeholder = 'EVP, e-mail, telefone, CPF/CNPJ';
    const pixKeyGroup = document.getElementById('pixKey')?.parentElement;
    if (pixKeyGroup) pixKeyGroup.classList.add('hidden');
  } else {
    if (destLabel) destLabel.textContent = 'Destino *';
    destInput.placeholder = '';
    const pixKeyGroup = document.getElementById('pixKey')?.parentElement;
    if (pixKeyGroup) pixKeyGroup.classList.remove('hidden');
  }
});

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
const sanitizeText = (s = '', max = 25) => {
    const t = (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').trim();
    return t.slice(0, max);
  };function sanitizeTxid(s = '') { return (s || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 25); }
function buildPixPayload({ pixKey, merchantName, merchantCity, amount, txid, description }) {
  const formatPixKey = (key) => {
    const k = (key || '').trim();
    if (k.includes('@')) return k; // Email
    if (/^[0-9a-fA-F-]{32,36}$/.test(k)) return k; // EVP
    
    const isPhoneFormat = /\([0-9]{2}\)/.test(k);
    const hasCountryCode = k.startsWith('+');
    const raw = k.replace(/[^0-9a-zA-Z]/g, '');
    
    if (hasCountryCode) return '+' + raw;
    if (isPhoneFormat) return '+55' + raw;
    
    if (/^\d+$/.test(raw)) {
       const isValidCPF = (cpf) => {
         if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
         let soma = 0, resto;
         for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
         resto = (soma * 10) % 11;
         if (resto === 10 || resto === 11) resto = 0;
         if (resto !== parseInt(cpf.substring(9, 10))) return false;
         soma = 0;
         for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
         resto = (soma * 10) % 11;
         if (resto === 10 || resto === 11) resto = 0;
         if (resto !== parseInt(cpf.substring(10, 11))) return false;
         return true;
       };
       if (raw.length === 11 && !isValidCPF(raw)) return '+55' + raw;
       if (raw.length === 10) return '+55' + raw;
    }

    return raw; 
  };

  const nmSan = sanitizeText(merchantName, 25);
  const citySan = sanitizeText(merchantCity, 15);
  const descSan = (description || '').toString().slice(0, 40);
  const txidSan = sanitizeTxid(txid);
  const pixKeySan = formatPixKey(pixKey);
  const amountSan = amount ? String(amount).replace(',', '.') : '';

  const acc = tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', pixKeySan) + (descSan ? tlv('02', descSan) : ''));
  const mcc = tlv('52', '0000');
  const cur = tlv('53', '986');
  const amt = amountSan ? tlv('54', String(parseFloat(amountSan).toFixed(2))) : '';
  const cty = tlv('58', 'BR');
  const nm = tlv('59', nmSan);
  const city = tlv('60', citySan);
  const add = tlv('62', tlv('05', txidSan || '***'));
  const base = tlv('00', '01') + tlv('01', '12') + acc + mcc + cur + amt + cty + nm + city + add + '6304';
  const crc = crc16(base);
  return base + crc;
}

// Add responsive style for canvas
const style = document.createElement('style');
style.innerHTML = `
  #qrCanvas {
    max-width: 100%;
    height: auto;
  }
`;
document.head.appendChild(style);
function parseTLV(str) {
  const map = {}; let i = 0;
  while (i + 4 <= str.length) {
    const id = str.slice(i, i + 2);
    const len = parseInt(str.slice(i + 2, i + 4), 10);
    const value = str.slice(i + 4, i + 4 + len);
    if (!Number.isNaN(len) && value.length === len) map[id] = value;
    i += 4 + len;
  }
  return map;
}
function parsePix(payload) {
  const top = parseTLV(payload);
  const acc = top['26'] ? parseTLV(top['26']) : {};
  const out = {
    pixKey: acc['01'] || '',
    description: acc['02'] || '',
    merchantName: top['59'] || '',
    merchantCity: top['60'] || '',
    amount: top['54'] || '',
    txid: (top['62'] ? (parseTLV(top['62'])['05'] || '') : '')
  };
  return out;
}

// Sidebar toggle logic
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const sidebar = document.querySelector('.sidebar');
const mainContent = document.querySelector('.main-content');
if (toggleSidebarBtn && sidebar && mainContent) {
    toggleSidebarBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
        // Save state
        const isCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebarState', isCollapsed ? 'collapsed' : 'expanded');
    });
}

// Logout logic
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await logoutUser();
            window.location.replace('../login.html');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    });
}

