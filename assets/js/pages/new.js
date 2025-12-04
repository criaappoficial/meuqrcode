import { observeAuth } from '../controllers/authController.js';
import { QRController, drawQRCode, downloadQRCode } from '../controllers/qrController.js';
import { showAlert } from '../views/ui.js';

const PRIMARY_DOMAIN = 'https://meusservicos.com.br';
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

observeAuth(null, () => window.location.replace('../index.html'));

const toSlug = (value) =>
  (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');

const normalizeUrl = (value = '') => {
  const v = (value || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[\w.-]+\.[a-z]{2,}([\/\?#].*)?$/i.test(v)) return `https://${v}`;
  return '';
};

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = form.title.value;
  const destination = normalizeUrl(form.destination.value);
  const active = form.active.checked;

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
    const created = await QRController.create({ title, destination, active, id: fixedId, fixedUrl: fixedUrlForSave });
    const qrUrl = composeQrUrl(created.id);
    qrUrlText.textContent = qrUrl;
    await drawQRCode('qrCanvas', qrUrl);
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
  const filename = `${(form.title.value || 'qrcode').replace(/\s+/g, '-').toLowerCase()}.png`;
  downloadQRCode('qrCanvas', filename);
});
const uniqueSuffix = () => (Date.now().toString(36) + Math.random().toString(36).slice(2, 4)).slice(-6);
