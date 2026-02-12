import { observeAuth, logoutUser, getUserProfile, deleteCurrentUser, updateAuthProfile } from '../controllers/authController.js';
import { createUserProfile, updateUserProfile } from '../models/userModel.js';
import { QRController, drawQRCode, downloadQRCode, drawQRCodeSvg, downloadQRCodeSvg } from '../controllers/qrController.js';
import { PricingModel } from '../models/pricingModel.js';
import { StatsController } from '../controllers/statsController.js';
import { showAlert, toggleState, renderRows, formatDate } from '../views/ui.js';
import { auth } from '../core/firebase.js';



console.log('Dashboard JS v2 loaded');

// AUTO-FIX: Garante que o usuário tenha um perfil no Firestore
async function ensureUserProfile(user) {
  try {
    const profile = await getUserProfile(user.uid);
    if (!profile) {
      console.log('Perfil não encontrado no Dashboard. Criando agora...');
      await createUserProfile(user.uid, {
        email: user.email,
        autoCreatedInDashboard: true
      });
      console.log('Perfil criado automaticamente pelo Dashboard.');
      showAlert(els.alert, 'Seu perfil foi configurado com sucesso!', 'success');
    } else {
      console.log('Perfil verificado: OK', profile);
    }
  } catch (error) {
    console.error('Erro ao verificar/criar perfil no Dashboard:', error);
  }
}

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
  settingsView: document.getElementById('settings-view'),
  profileEditView: document.getElementById('profile-edit-view'),
  btnNewQr: document.getElementById('btn-new-qr'),

  btnBackDashboard: document.getElementById('btn-back-dashboard'),
  btnBackDashboard2: document.getElementById('btn-back-dashboard-2'),

  // Menu Links
  menuSettings: document.getElementById('menu-settings'),
  menuDashboard: document.querySelector('a[href="dashboard.html"]'),

  // Delete Account Modal
  btnDeleteAccount: document.getElementById('btn-delete-account'),
  deleteAccountModal: document.getElementById('deleteAccountModal'),
  cancelDeleteAccount: document.getElementById('cancelDeleteAccount'),
  cancelDeleteAccountBtn: document.getElementById('cancelDeleteAccountBtn'),
  confirmDeleteAccountBtn: document.getElementById('confirmDeleteAccountBtn'),
  deleteConfirmationInput: document.getElementById('deleteConfirmationInput'),
  settingsEmailDisplay: document.getElementById('settingsEmailDisplay'),
  settingsNameDisplay: document.getElementById('settingsNameDisplay'),
  settingsAvatar: document.getElementById('settingsAvatar'),
  userAvatar: document.getElementById('userAvatar'),
  btnEditProfile: document.getElementById('btn-edit-profile'),

  // Profile Form
  profileForm: document.getElementById('profileForm'),
  displayName: document.getElementById('displayName'),
  profileEmail: document.getElementById('profileEmail'),
  avatarInput: document.getElementById('avatarInput'),
  avatarEditPreview: document.getElementById('avatarEditPreview'),
  btnBackSettings: document.getElementById('btn-back-settings'),
  btnCancelProfile: document.getElementById('btn-cancel-profile'),
  saveProfileBtn: document.getElementById('saveProfileBtn'),


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
  els.settingsView?.classList.add('hidden');
  els.profileEditView?.classList.add('hidden');
  els.dashboardView.classList.remove('hidden');


  // Update Active Menu
  els.menuDashboard?.classList.add('active');
  els.menuSettings?.classList.remove('active');

  loadDashboard(); // Refresh data
};

const showNewQr = () => {
  // selectedDocId = null; // Removed: selectedDocId should be managed by caller (btnNewQr or edit action)
  els.dashboardView.classList.add('hidden');
  els.settingsView?.classList.add('hidden');
  els.profileEditView?.classList.add('hidden');
  els.newQrView.classList.remove('hidden');


  els.menuDashboard?.classList.remove('active');
  els.menuSettings?.classList.remove('active');

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

const showSettings = (e) => {
  e?.preventDefault();
  els.dashboardView.classList.add('hidden');
  els.newQrView.classList.add('hidden');
  els.profileEditView?.classList.add('hidden');
  els.settingsView?.classList.remove('hidden');


  // Update Active Menu
  els.menuDashboard?.classList.remove('active');
  els.menuSettings?.classList.add('active');
};

const showProfileEdit = () => {
  els.settingsView?.classList.add('hidden');
  els.profileEditView?.classList.remove('hidden');

  // Load data to form
  const user = auth.currentUser;
  if (user) {
    els.displayName.value = user.displayName || '';
    els.profileEmail.value = user.email || '';

    if (user.photoURL) {
      els.avatarEditPreview.innerHTML = `<img src="${user.photoURL}" style="width:100%; height:100%; object-fit:cover;">`;
    } else {
      els.avatarEditPreview.innerHTML = `<i class="fas fa-user"></i>`;
    }
  }
};


els.btnNewQr?.addEventListener('click', () => {
  selectedDocId = null; // Explicitly clear for new
  showNewQr();
});

// Menu Listeners
els.menuSettings?.addEventListener('click', showSettings);
els.btnEditProfile?.addEventListener('click', showProfileEdit);
els.btnBackSettings?.addEventListener('click', showSettings);
els.btnCancelProfile?.addEventListener('click', showSettings);

// Avatar Preview & Base64 Conversion
let selectedAvatarBase64 = null;

els.avatarInput?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    if (file.size > 2 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 2MB');
      els.avatarInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize image to keep base64 string small (e.g., max 200x200)
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 200;
        const MAX_HEIGHT = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        selectedAvatarBase64 = canvas.toDataURL('image/jpeg', 0.7); // Compress to JPEG 70%
        els.avatarEditPreview.innerHTML = `<img src="${selectedAvatarBase64}" style="width:100%; height:100%; object-fit:cover;">`;
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }
});

// Profile Save
els.profileForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  els.saveProfileBtn.disabled = true;
  els.saveProfileBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

  try {
    const photoURL = selectedAvatarBase64 || user.photoURL;
    const displayName = els.displayName.value.trim();

    // Update Auth (Only Display Name, to avoid length limit for photoURL)
    await updateAuthProfile({ displayName });

    // Update Firestore (Safe to store Base64 photoURL here)
    await updateUserProfile(user.uid, { displayName, photoURL });

    showAlert(els.alert, 'Perfil atualizado com sucesso!', 'success');

    // Force refresh UI using the new data
    updateUIWithUserData({ ...user, displayName, photoURL });
    showSettings();
  } catch (error) {
    console.error('Erro ao salvar perfil:', error);
    showAlert(els.alert, 'Erro ao salvar perfil: ' + error.message, 'error');
  } finally {
    els.saveProfileBtn.disabled = false;
    els.saveProfileBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Perfil';
  }
});

function updateUIWithUserData(user) {
  if (!user) return;

  const displayName = user.displayName || user.email.split('@')[0];
  const photoURL = user.photoURL;

  // Navbar Avatar
  if (els.userAvatar) {
    if (photoURL) {
      els.userAvatar.innerHTML = `<img src="${photoURL}" style="width:100%; height:100%; object-fit:cover;">`;
    } else {
      els.userAvatar.innerHTML = `<i class="fas fa-user"></i>`;
    }
  }

  // Settings Avatar
  if (els.settingsAvatar) {
    if (photoURL) {
      els.settingsAvatar.innerHTML = `<img src="${photoURL}" style="width:100%; height:100%; object-fit:cover;">`;
    } else {
      els.settingsAvatar.innerHTML = `<i class="fas fa-user"></i>`;
    }
  }

  // Settings Name
  if (els.settingsNameDisplay) {
    els.settingsNameDisplay.textContent = displayName;
  }

  // Greeting
  const hour = new Date().getHours();
  const saudacao = (hour >= 5 && hour < 12) ? 'Bom dia' : (hour >= 12 && hour < 18) ? 'Boa tarde' : 'Boa noite';
  const shortName = displayName.split(/\s+/)[0];
  const greetingText = `Olá, ${shortName}! ${saudacao}`;
  const greetingEl = document.getElementById('greeting');
  if (greetingEl) greetingEl.textContent = greetingText;
}




// Delete Account Logic
els.btnDeleteAccount?.addEventListener('click', () => {
  els.deleteAccountModal?.classList.remove('hidden');
  els.deleteConfirmationInput.value = '';
  els.confirmDeleteAccountBtn.disabled = true;
});

const closeDeleteAccountModal = () => {
  els.deleteAccountModal?.classList.add('hidden');
};

els.cancelDeleteAccount?.addEventListener('click', closeDeleteAccountModal);
els.cancelDeleteAccountBtn?.addEventListener('click', closeDeleteAccountModal);

els.deleteConfirmationInput?.addEventListener('input', (e) => {
  if (e.target.value === 'DELETAR') {
    els.confirmDeleteAccountBtn.disabled = false;
  } else {
    els.confirmDeleteAccountBtn.disabled = true;
  }
});

els.confirmDeleteAccountBtn?.addEventListener('click', async () => {
  try {
    els.confirmDeleteAccountBtn.textContent = 'Excluindo...';
    els.confirmDeleteAccountBtn.disabled = true;

    await deleteCurrentUser();

    alert('Sua conta foi excluída com sucesso.');
    window.location.replace('../login.html');
  } catch (error) {
    console.error('Erro ao excluir conta:', error);
    if (error.code === 'auth/requires-recent-login') {
      alert('Por segurança, você precisa fazer login novamente antes de excluir sua conta. Redirecionando...');
      await logoutUser();
      window.location.replace('../login.html');
    } else {
      alert('Erro ao excluir conta: ' + error.message);
      els.confirmDeleteAccountBtn.textContent = 'Excluir permanentemente';
      els.confirmDeleteAccountBtn.disabled = false;
    }
  }
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

observeAuth(async (user) => {
  currentUserId = user?.uid || null;
  currentUserEmail = user?.email || null;

  // Update Settings Profile Info
  if (els.settingsEmailDisplay) {
    els.settingsEmailDisplay.textContent = user.email;
  }


  // Check pricing status
  try {
    await PricingModel.checkPricingStatus(user.uid);
  } catch (e) { console.error(e); }
  // Ensure profile exists (Auto-fix)
  await ensureUserProfile(user);

  // Load Firestore profile to get the Base64 photoURL if it exists
  const profile = await getUserProfile(user.uid);
  updateUIWithUserData({
    ...user,
    displayName: profile?.displayName || user.displayName,
    photoURL: profile?.photoURL || user.photoURL
  });

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
      // If 11 digits and NOT valid CPF, assume Phone (+55)
      if (raw.length === 11 && !isValidCPF(raw)) return '+55' + raw;
      // If 10 digits (Landline), assume Phone (+55)
      if (raw.length === 10) return '+55' + raw;
    }

    return raw;
  };

  const sanitizeText = (s = '', max = 25) => {
    const t = (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').trim();
    return t.slice(0, max);
  };
  const sanitizeTxid = (s = '') => (s || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 25);

  const pixKeySan = formatPixKey(pixKey);
  const nmSan = sanitizeText(merchantName, 25);
  const citySan = sanitizeText(merchantCity, 15);
  const descSan = (description || '').toString().slice(0, 40);
  const txidSan = sanitizeTxid(txid);
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

  // Verify length of fields
  if (nmSan.length === 0) console.warn('Merchant Name is empty');
  if (citySan.length === 0) console.warn('Merchant City is empty');

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

      // Log Edit Action
      await StatsController.logAction(currentUserId, currentUserEmail, 'edited');

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

      // Log Create Action
      await StatsController.logAction(currentUserId, currentUserEmail, 'created');

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
const sidebarOverlay = document.getElementById('sidebarOverlay');

if (mobileMenuBtn && sidebar) {
  const toggleMenu = () => {
    sidebar.classList.toggle('active');
    if (sidebarOverlay) {
      sidebarOverlay.classList.toggle('active');
    }
  };

  const closeMenu = () => {
    sidebar.classList.remove('active');
    if (sidebarOverlay) {
      sidebarOverlay.classList.remove('active');
    }
  };

  mobileMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  // Close when clicking overlay
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeMenu);
  }

  // Close sidebar when clicking outside on mobile (fallback if no overlay)
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 900 &&
      sidebar.classList.contains('active') &&
      !sidebar.contains(e.target) &&
      !mobileMenuBtn.contains(e.target)) {
      closeMenu();
    }
  });

  // Close menu when clicking a link in sidebar
  const sidebarLinks = sidebar.querySelectorAll('a');
  sidebarLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 900) {
        closeMenu();
      }
    });
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

    // Trigger real-time update
    // updateProjectedCost(); // Removed as per user request to NOT update on edit start

    isEditingPopulation = false;
    // Trigger cost update to reflect current edit state in pricing UI
    updateProjectedCost();
    return;
  }

  if (target.dataset.action === 'delete') {
    selectedDocId = docId;
    document.getElementById('modalMessage').innerHTML = `Tem certeza que deseja excluir <strong>${title || 'este QR Code'}</strong>?`;
    toggleState(els.deleteModal, true);
  }

  if (target.dataset.action === 'preview') {
    if (!publicId) return;

    // Log View Action
    StatsController.logAction(currentUserId, currentUserEmail, 'viewed').catch(console.error);

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
      try { updatePricingUI([]); } catch (e) { console.error('Pricing Error:', e); }
      toggleState(els.emptyState, true);
      toggleState(els.tableWrap, false);
      return;
    }

    try { updatePricingUI(qrCodes); } catch (e) { console.error('Pricing Error:', e); }
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

  // Update WhatsApp Link in Modal AND Summary Container
  const btnWhatsapp = document.getElementById('btnWhatsappAccess');
  const summaryContainer = document.getElementById('planSummaryContainer');

  if (btnWhatsapp || summaryContainer) {
    const breakdown = pricing.breakdown;
    let featuresText = `*Resumo do Plano:*%0A`;
    featuresText += `- Total QR Codes Ativos: ${breakdown.activeQRs}%0A`;
    if (breakdown.extraQRs > 0) featuresText += `- QR Codes Extras (Pagos): ${breakdown.extraQRs}%0A`;
    if (breakdown.paidColors > 0) featuresText += `- Personalizações de Cor: ${breakdown.paidColors}%0A`;
    if (breakdown.sizeCost > 0) featuresText += `- Adicional de Tamanho: ${breakdown.sizeCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}%0A`;

    const message = `Olá! Gostaria de liberar meu acesso ao MeuQRCode.%0A%0A` +
      `*Valor Mensal:* ${pricing.formattedTotal}%0A` +
      `${featuresText}%0A` +
      `Aguardo instruções para pagamento e liberação.`;

    if (btnWhatsapp) {
      btnWhatsapp.href = `https://wa.me/5588933005519?text=${message}`;
    }

    if (summaryContainer) {
      let htmlSummary = `<strong>Valor Mensal: <span style="color:var(--primary); font-size:1.1rem;">${pricing.formattedTotal}</span></strong><br><br>`;
      htmlSummary += `<ul style="list-style:none; padding:0; margin:0;">`;
      htmlSummary += `<li><i class="fas fa-check-circle" style="color:var(--success); margin-right:6px;"></i> Total QR Codes Ativos: <strong>${breakdown.activeQRs}</strong></li>`;
      if (breakdown.extraQRs > 0) htmlSummary += `<li><i class="fas fa-plus-circle" style="color:var(--primary); margin-right:6px;"></i> Extras (Pagos): <strong>${breakdown.extraQRs}</strong></li>`;
      if (breakdown.paidColors > 0) htmlSummary += `<li><i class="fas fa-palette" style="color:var(--primary); margin-right:6px;"></i> Cores Pagas: <strong>${breakdown.paidColors}</strong></li>`;
      if (breakdown.sizeCost > 0) htmlSummary += `<li><i class="fas fa-expand" style="color:var(--primary); margin-right:6px;"></i> Adicional Tamanho: <strong>${breakdown.sizeCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></li>`;
      htmlSummary += `</ul>`;
      summaryContainer.innerHTML = htmlSummary;
    }
  }
}
