import { observeAuth } from '../controllers/authController.js';
import { QRController, drawQRCode, downloadQRCode } from '../controllers/qrController.js';
import { showAlert } from '../views/ui.js';

const PRIMARY_DOMAIN = 'https://meusservicos.com.br';
const BASE_URL = (['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)) ? window.location.origin : PRIMARY_DOMAIN;
const composeQrUrl = (id) => (BASE_URL === window.location.origin)
  ? `${window.location.origin}/page/index.html?id=${id}`
  : `${PRIMARY_DOMAIN}/${id}`;

const normalizeUrl = (value = '') => {
  const v = (value || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[\w.-]+\.[a-z]{2,}([\/\?#].*)?$/i.test(v)) return `https://${v}`;
  return '';
};

const params = new URLSearchParams(window.location.search);
const docId = params.get('id');

const els = {
  form: document.getElementById('qrForm'),
  alert: document.getElementById('alert-container'),
  loading: document.getElementById('loading'),
  preview: document.getElementById('qrPreview'),
  qrUrl: document.getElementById('qrUrl'),
  submit: document.getElementById('submitBtn'),
  colorMode: document.getElementById('colorMode'),
  customColors: document.getElementById('customColors'),
  colorDark: document.getElementById('colorDark'),
  colorLight: document.getElementById('colorLight'),
  size: document.getElementById('size')
};

let currentRecord = null;
if (!docId) window.location.replace('dashboard.html');

observeAuth(() => init(), () => window.location.replace('../index.html'));

els.colorMode?.addEventListener('change', () => {
  if (els.colorMode.value === 'custom') {
    els.customColors.classList.remove('hidden');
  } else {
    els.customColors.classList.add('hidden');
  }
});

const getSelectedColors = () => {
  const mode = els.colorMode ? els.colorMode.value : 'standard-bw';
  if (mode === 'standard-wb') return { dark: '#FFFFFF', light: '#000000' };
  if (mode === 'custom') return { dark: els.colorDark.value, light: els.colorLight.value };
  return { dark: '#000000', light: '#FFFFFF' };
};

async function init() {
  try {
    const data = await QRController.find(docId);
    if (!data) {
      showAlert(els.alert, 'QR Code não encontrado.', 'error');
      setTimeout(() => window.location.replace('dashboard.html'), 1500);
      return;
    }
    currentRecord = data;
    els.form.title.value = data.title;
    els.form.destination.value = data.destination;
    els.form.active.checked = data.active !== false;

    if (data.options) {
      if (els.size) els.size.value = data.options.size || 320;
      
      if (data.options.isCustomColor) {
        els.colorMode.value = 'custom';
        els.customColors.classList.remove('hidden');
        if (data.options.colors) {
          els.colorDark.value = data.options.colors.dark;
          els.colorLight.value = data.options.colors.light;
        }
      } else {
        if (data.options.colors?.dark === '#FFFFFF' && data.options.colors?.light === '#000000') {
          els.colorMode.value = 'standard-wb';
        } else {
          els.colorMode.value = 'standard-bw';
        }
        els.customColors.classList.add('hidden');
      }
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
  const payload = {
    title: els.form.title.value,
    destination: normalizeUrl(els.form.destination.value),
    active: els.form.active.checked,
    options: {
      size: els.size ? els.size.value : 320,
      colors: getSelectedColors(),
      isCustomColor: els.colorMode ? els.colorMode.value === 'custom' : false
    }
  };

  if (!payload.destination) {
    showAlert(els.alert, 'Informe uma URL válida para o destino (ex.: https://exemplo.com).', 'error');
    return;
  }

  els.submit.disabled = true;
  els.submit.innerHTML = '<span class="loading"></span> Salvando...';

  try {
    await QRController.update(docId, payload);
    const displayUrl = (BASE_URL === window.location.origin)
      ? composeQrUrl(currentRecord.id)
      : (currentRecord.fixedUrl || composeQrUrl(currentRecord.id));
    const qrCodeUrl = currentRecord.fixedUrl || composeQrUrl(currentRecord.id);
    els.qrUrl.textContent = displayUrl;
    await drawQRCode('qrCanvas', qrCodeUrl, payload.options);
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
