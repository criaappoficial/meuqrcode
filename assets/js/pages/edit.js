import { observeAuth } from '../controllers/authController.js';
import { QRController, drawQRCode, downloadQRCode } from '../controllers/qrController.js';
import { showAlert } from '../views/ui.js';

const BASE_URL = 'https://meusservicospro.com.br';

const params = new URLSearchParams(window.location.search);
const docId = params.get('id');

const els = {
  form: document.getElementById('qrForm'),
  alert: document.getElementById('alert-container'),
  loading: document.getElementById('loading'),
  preview: document.getElementById('qrPreview'),
  qrUrl: document.getElementById('qrUrl'),
  submit: document.getElementById('submitBtn')
};

let currentRecord = null;
if (!docId) window.location.replace('dashboard.html');

observeAuth(() => init(), () => window.location.replace('../index.html'));

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
    destination: els.form.destination.value,
    active: els.form.active.checked
  };

  els.submit.disabled = true;
  els.submit.innerHTML = '<span class="loading"></span> Salvando...';

  try {
    await QRController.update(docId, payload);
    const qrUrl = `${BASE_URL}/${currentRecord.id}`;
    els.qrUrl.textContent = qrUrl;
    await drawQRCode('qrCanvas', qrUrl);
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
