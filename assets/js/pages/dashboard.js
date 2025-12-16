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
  qrPreviewCanvas: document.getElementById('qrPreviewCanvas')
};

let selectedDocId = null;
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
  loadDashboard();
}, () => window.location.replace('../login.html'));

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
  }

  if (target.dataset.action === 'preview') {
    if (!publicId) return;
    const fixedUrl = target.dataset.fixedUrl;
    const dest = target.dataset.destination || '';
    const isPix = /^000201/.test(dest) && /br\.gov\.bcb\.pix/.test(dest);
    const qrValue = isPix
      ? dest
      : ((BASE_URL === window.location.origin) ? composeQrUrl(publicId) : (fixedUrl || composeQrUrl(publicId)));
    els.qrPreviewUrl.textContent = qrValue;
    toggleState(els.qrPreviewModal, true);
    drawQRCode('qrPreviewCanvas', qrValue).catch(console.error);
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
    drawQRCode('qrPreviewCanvas', qrValue)
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
    drawQRCode('qrPreviewCanvas', qrValue)
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
    const qrCodes = currentUserId ? await QRController.mine(currentUserId) : [];
    toggleState(els.loading, false);

    if (!qrCodes.length) {
      toggleState(els.emptyState, true);
      toggleState(els.tableWrap, false);
      return;
    }

    toggleState(els.emptyState, false);
    toggleState(els.tableWrap, true);

    renderRows(els.tableBody, qrCodes, (qr) => `
      <tr>
        <td>${qr.title || 'Sem título'}</td>
        <td class="col-destination"><a href="${qr.destination}" target="_blank">${truncate(qr.destination)}</a></td>
        <td class="col-qr">
          <button class="icon-button" title="Ver QR Code" data-action="preview" data-id="${qr.docId}" data-title="${qr.title}" data-destination="${qr.destination}" data-public-id="${qr.id}" data-fixed-url="${qr.fixedUrl || ''}">🔍</button>
        </td>
        <td><span class="badge ${qr.active ? 'badge-active' : 'badge-inactive'}">${qr.active ? 'Ativo' : 'Inativo'}</span></td>
        <td>${formatDate(qr.createdAt)}</td>
        <td>
          <div class="actions">
            <button class="icon-button" title="Editar" data-action="edit" data-id="${qr.docId}" data-title="${qr.title}">✏️</button>
            <button class="icon-button" title="Baixar QR Code" data-action="download" data-id="${qr.docId}" data-title="${qr.title}" data-public-id="${qr.id}" data-fixed-url="${qr.fixedUrl || ''}">📥</button>
            <button class="icon-button" title="Imprimir QR Code" data-action="print" data-id="${qr.docId}" data-title="${qr.title}" data-public-id="${qr.id}" data-fixed-url="${qr.fixedUrl || ''}">🖨️</button>
            <button class="icon-button" title="Excluir" data-action="delete" data-id="${qr.docId}" data-title="${qr.title}">🗑</button>
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
