import { observeAuth } from '../controllers/authController.js';
import { QRController, drawQRCode, downloadQRCode } from '../controllers/qrController.js';
import { showAlert } from '../views/ui.js';

const BASE_URL = 'https://meusservicospro.com.br';

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

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = form.title.value;
  const destination = form.destination.value;
  const active = form.active.checked;

  // monta caminho fixo: usuario/slug
  const userPart = toSlug(fixedUserInput?.value) || 'meus-servicos';
  const slugPart = toSlug(fixedSlugInput?.value || title) || 'meu-link';
  const fixedId = `${userPart}/${slugPart}`;

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="loading"></span> Gerando...';

  try {
    const created = await QRController.create({ title, destination, active, id: fixedId });
    const qrUrl = `${BASE_URL}/${created.id}`;
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
