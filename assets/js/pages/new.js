import { observeAuth } from '../controllers/authController.js';
import { QRController, drawQRCode, downloadQRCode, drawQRCodeSvg, downloadQRCodeSvg } from '../controllers/qrController.js';
import { showAlert } from '../views/ui.js';

const PRIMARY_DOMAIN = 'https://qrcode-alugueja.netlify.app';
const BASE_URL = (['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)) ? window.location.origin : PRIMARY_DOMAIN;
const composeQrUrl = (id) => (BASE_URL === window.location.origin)
  ? `${window.location.origin}/page/index.html?id=${id}`
  : `${PRIMARY_DOMAIN}/${id}`;

const form = document.getElementById('qrForm');
const alertContainer = document.getElementById('alert-container');
const submitBtn = document.getElementById('submitBtn');
const preview = document.getElementById('qrPreview');
const qrUrlText = document.getElementById('qrUrl');
const fixedUserInput = document.getElementById('fixedUser');
const fixedSlugInput = document.getElementById('fixedSlug');
const styleSelect = document.getElementById('qrStyle');
const formatSelect = document.getElementById('qrFormat');
const qrSvgWrap = document.getElementById('qrSvgWrap');
const contentTypeSelect = document.getElementById('contentType');
const pixFields = document.getElementById('pixFields');
const pixKeyInput = document.getElementById('pixKey');
const merchantNameInput = document.getElementById('merchantName');
const merchantCityInput = document.getElementById('merchantCity');
const amountInput = document.getElementById('amount');
const txidInput = document.getElementById('txid');
const descriptionInput = document.getElementById('description');

let currentUserId = null;
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
}, () => window.location.replace('../login.html'));

const toSlug = (value) =>
  (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');

const getContent = (value = '') => (value || '').trim();

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = form.title.value;
  const isPix = contentTypeSelect?.value === 'pix';
  const destination = isPix ? '' : getContent(form.destination.value);
  const active = form.active.checked;
  if (!destination && !isPix) {
    showAlert(alertContainer, 'Informe o conteúdo do QR (texto, link, pix, email, etc.).', 'error');
    return;
  }
  if (isPix) {
    if (!pixKeyInput?.value || !merchantNameInput?.value || !merchantCityInput?.value) {
      showAlert(alertContainer, 'Preencha chave, nome e cidade para PIX.', 'error');
      return;
    }
  }

  const userPartRaw = toSlug(fixedUserInput?.value) || 'meus-servicos';
  const rawSlug = fixedSlugInput?.value || '';
  const isUrlLike = /^https?:/i.test(rawSlug) || rawSlug.includes('.');
  const slugPartRaw = isUrlLike ? '' : toSlug(rawSlug);
  const userPart = userPartRaw.replace(/-/g, '');
  const fixedId = slugPartRaw ? slugPartRaw : `${userPart}${uniqueSuffix()}`;
  const fixedUrlForSave = `${PRIMARY_DOMAIN}/${fixedId}`;

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="loading"></span> Gerando...';

  try {
    const isPix = contentTypeSelect?.value === 'pix';
    const destinationToSave = isPix ? buildPixPayload({
      pixKey: pixKeyInput.value,
      merchantName: merchantNameInput.value,
      merchantCity: merchantCityInput.value,
      amount: amountInput.value,
      txid: txidInput.value,
      description: descriptionInput.value
    }) : destination;
    const created = await QRController.create({ title, destination: destinationToSave, active, id: fixedId, fixedUrl: fixedUrlForSave, ownerId: currentUserId });
    const displayUrl = (BASE_URL === window.location.origin)
      ? composeQrUrl(created.id)
      : (created.fixedUrl || composeQrUrl(created.id));
    const style = (styleSelect?.value || 'default');
    const format = (formatSelect?.value || 'png');
    const pixPayload = isPix ? buildPixPayload({
      pixKey: pixKeyInput.value,
      merchantName: merchantNameInput.value,
      merchantCity: merchantCityInput.value,
      amount: amountInput.value,
      txid: txidInput.value,
      description: descriptionInput.value
    }) : null;
    const valueForQr = isPix ? pixPayload : (created.fixedUrl || composeQrUrl(created.id));
    qrUrlText.textContent = isPix ? pixPayload : displayUrl;
    await drawStyledQR(valueForQr, style, format);
    preview.classList.remove('hidden');
    form.classList.add('hidden');
    showAlert(alertContainer, 'QR Code criado com sucesso!', 'success');
  } catch (error) {
    showAlert(alertContainer, 'Erro ao criar QR Code.', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Criar QR Code';
    console.error(error);
  }
});

const downloadBtn = document.getElementById('downloadBtn');
downloadBtn?.addEventListener('click', () => {
  const format = (formatSelect?.value || 'png');
  const filenameBase = (form.title.value || 'qrcode').replace(/\s+/g, '-').toLowerCase();
  if (format === 'svg') {
    downloadQRCodeSvg('qrSvgWrap', `${filenameBase}.svg`);
  } else {
    downloadQRCode('qrCanvas', `${filenameBase}.png`);
  }
});
const uniqueSuffix = () => (Date.now().toString(36) + Math.random().toString(36).slice(2, 4)).slice(-6);
function drawStyledQR(value, style = 'default', format = 'png') {
  const optionsByStyle = {
    default: { color: { dark: '#050814', light: '#FFFFFF' } },
    dark: { color: { dark: '#000000', light: '#FFFFFF' } },
    light: { color: { dark: '#333333', light: '#FAFAFA' } },
    blue: { color: { dark: '#1f4ed8', light: '#FFFFFF' } }
  };
  const opts = optionsByStyle[style] || optionsByStyle.default;
  if (format === 'svg') {
    return drawQRCodeSvg('qrSvgWrap', value, opts).then(() => {
      qrSvgWrap.style.display = 'block';
      const canvas = document.getElementById('qrCanvas');
      if (canvas) canvas.style.display = 'none';
    });
  }
  qrSvgWrap.style.display = 'none';
  const canvas = document.getElementById('qrCanvas');
  if (canvas) canvas.style.display = 'block';
  return drawQRCode('qrCanvas', value, opts);
}
contentTypeSelect?.addEventListener('change', () => {
  const isPix = contentTypeSelect.value === 'pix';
  pixFields.classList[isPix ? 'remove' : 'add']('hidden');
  document.getElementById('destinationGroup').classList[isPix ? 'add' : 'remove']('hidden');
  const destInput = document.getElementById('destination');
  if (destInput) destInput.required = !isPix;
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
