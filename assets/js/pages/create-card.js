import { observeAuth, logoutUser, getUserProfile } from '../controllers/authController.js';
import { PricingModel } from '../models/pricingModel.js';
import { QRController, drawQRCode } from '../controllers/qrController.js';
import { showAlert } from '../views/ui.js';



const MODELS = [
    {
        id: 'classic',
        name: 'Clássico',
        desc: 'O padrão quadrado tradicional, ideal para qualquer situação.',
        tag: 'Grátis',
        tagClass: 'tag-free',
        premium: false,
        options: { color: { dark: '#000000', light: '#ffffff' } }
    },
    {
        id: 'modern',
        name: 'Moderno',
        desc: 'Cantos arredondados e bordas suaves para um visual clean.',
        tag: 'Grátis',
        tagClass: 'tag-free',
        premium: false,
        options: { color: { dark: '#050814', light: '#ffffff' }, margin: 4 }
    },
    {
        id: 'corporate',
        name: 'Corporativo',
        desc: 'Azul profissional com alta legibilidade.',
        tag: 'Premium',
        tagClass: 'tag-premium',
        premium: true,
        options: { color: { dark: '#1f4ed8', light: '#ffffff' } }
    },
    {
        id: 'minimalist',
        name: 'Minimalista',
        desc: 'Cinza suave, discreto e elegante.',
        tag: 'Premium',
        tagClass: 'tag-premium',
        premium: true,
        options: { color: { dark: '#4b5563', light: '#f9fafb' } }
    },
    {
        id: 'vibrant',
        name: 'Vibrante',
        desc: 'Um toque de cor para destacar sua marca.',
        tag: 'Premium',
        tagClass: 'tag-premium',
        premium: true,
        options: { color: { dark: '#7c3aed', light: '#ffffff' } }
    }
];

const els = {
    modelsGrid: document.getElementById('modelsGrid'),
    confirmModal: document.getElementById('confirmModelModal'),
    modalModelName: document.getElementById('modalModelName'),
    modalPreview: document.getElementById('modalPreviewContainer'),
    btnConfirm: document.getElementById('btnConfirmSelection'),
    btnCancel: document.getElementById('btnCancelSelection'),
    closeModal: document.getElementById('closeConfirmModal'),
    modelsView: document.getElementById('models-view'),
    creationView: document.getElementById('card-creation-view'),
    selectedPreview: document.getElementById('selectedModelPreview'),
    btnBackModels: document.getElementById('btnBackToModels'),
    userAvatar: document.getElementById('userAvatar'),
    alert: document.getElementById('alert-container'),
    cardForm: document.getElementById('cardForm'),
    contentType: document.getElementById('contentType'),
    pixFields: document.getElementById('pixFields'),
    destinationGroup: document.getElementById('destinationGroup'),
    fixedUser: document.getElementById('fixedUser'),
    fixedSlug: document.getElementById('fixedSlug'),
    btnCancelCardForm: document.getElementById('btnCancelCardForm'),
    blockModal: document.getElementById('blockModal'),
    okBlockModal: document.getElementById('okBlockModal'),
    closeBlockModal: document.getElementById('closeBlockModal'),
    planSummary: document.getElementById('planSummaryContainer'),
    btnWhatsapp: document.getElementById('btnWhatsappAccess')
};



// Helpers
const toSlug = (value) =>
    (value || '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-]/g, '');

const uniqueSuffix = () => (Date.now().toString(36) + Math.random().toString(36).slice(2, 4)).slice(-6);

// Performance Helper
const onIdle = (fn) => {
    if (window.requestIdleCallback) return window.requestIdleCallback(fn);
    return setTimeout(fn, 1);
};

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
        if (k.includes('@')) return k;
        const raw = k.replace(/[^0-9a-zA-Z]/g, '');
        if (k.startsWith('+')) return '+' + raw;
        if (/\([0-9]{2}\)/.test(k)) return '+55' + raw;
        return raw;
    };

    const sanitizeText = (s = '', max = 25) => {
        const t = (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').trim();
        return t.slice(0, max);
    };

    const pixKeySan = formatPixKey(pixKey);
    const nmSan = sanitizeText(merchantName, 25);
    const citySan = sanitizeText(merchantCity, 15);
    const descSan = (description || '').toString().slice(0, 40);
    const amountSan = amount ? String(amount).replace(',', '.') : '';

    const acc = tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', pixKeySan) + (descSan ? tlv('02', descSan) : ''));
    const base = tlv('00', '01') + tlv('01', '12') + acc + tlv('52', '0000') + tlv('53', '986') + (amountSan ? tlv('54', String(parseFloat(amountSan).toFixed(2))) : '') + tlv('58', 'BR') + tlv('59', nmSan) + tlv('60', citySan) + tlv('62', tlv('05', '***')) + '6304';

    return base + crc16(base);
}


let selectedModel = null;
let currentUserId = null;
let currentUserEmail = null;

// Initialize
observeAuth(async (user) => {
    currentUserId = user.uid;
    currentUserEmail = user.email;
    loadUserData(user);
    renderModels();
}, () => window.location.replace('../login.html'));

async function loadUserData(user) {
    const profile = await getUserProfile(user.uid);
    const photoURL = profile?.photoURL || user.photoURL;
    if (els.userAvatar) {
        if (photoURL) {
            els.userAvatar.innerHTML = `<img src="${photoURL}" style="width:100%; height:100%; object-fit:cover;">`;
        } else {
            els.userAvatar.innerHTML = `<i class="fas fa-user"></i>`;
        }
    }
}

async function renderModels() {
    console.log('Rendering models...');
    els.modelsGrid.innerHTML = '';

    // 1. Create all cards immediately to show the titles/layout
    const cards = MODELS.map(model => {
        const card = document.createElement('div');
        card.className = 'model-card';
        card.innerHTML = `
            <div class="model-preview" id="preview-${model.id}">
                <div class="model-tag ${model.tagClass}">${model.tag}</div>
                <div class="qr-wrapper ${'qr-' + model.id}" style="min-height: 120px; display: flex; align-items: center; justify-content: center;">
                    <canvas id="canvas-${model.id}" style="max-width: 120px;"></canvas>
                </div>
            </div>
            <div class="model-info">
                <div class="model-title">${model.name}</div>
                <div class="model-desc">${model.desc}</div>
            </div>
        `;
        card.onclick = () => openConfirmation(model);
        els.modelsGrid.appendChild(card);
        return { card, model };
    });

    // 2. Draw QR codes sequentially during idle time
    for (const { model } of cards) {
        await new Promise(resolve => {
            onIdle(async () => {
                try {
                    const canvasId = `canvas-${model.id}`;
                    await drawQRCode(canvasId, 'https://meuqrcode.com', {
                        width: 120, // Lower resolution for preview
                        ...model.options
                    });
                } catch (err) {
                    console.error(`Error drawing QR for ${model.id}:`, err);
                } finally {
                    resolve();
                }
            });
        });
    }
}


function openConfirmation(model) {
    selectedModel = model;
    els.modalModelName.textContent = model.name;
    els.modalPreview.innerHTML = `<div class="qr-wrapper ${'qr-' + model.id}"><canvas id="modalCanvas"></canvas></div>`;
    els.confirmModal.classList.remove('hidden');

    setTimeout(async () => {
        try {
            await drawQRCode('modalCanvas', 'https://meuqrcode.com', {
                width: 220,
                ...model.options
            });
        } catch (err) {
            console.error('Error drawing modal QR:', err);
        }
    }, 50);
}

if (els.closeModal) els.closeModal.onclick = () => els.confirmModal.classList.add('hidden');
if (els.btnCancel) els.btnCancel.onclick = () => els.confirmModal.classList.add('hidden');

if (els.btnConfirm) {
    els.btnConfirm.onclick = async () => {
        if (!selectedModel) return;

        if (selectedModel.premium && !isVipUser()) {
            els.confirmModal.classList.add('hidden');
            showPremiumBlock(selectedModel, 'customization');
            return;
        }

        els.confirmModal.classList.add('hidden');
        proceedToCreation();
    };
}


const isVipUser = () => {
    return [
        'admin@example.com',
        'suporte@meuqrcode.com',
        'fernandoamerico2@gmail.com'
    ].includes(currentUserEmail);
};

function showPremiumBlock(model, reason = 'customization') {
    if (els.blockModal) {
        let cost = PricingModel.COSTS.PAID_COLOR;
        let title = 'Estilo Exclusivo';
        let desc = 'Este modelo faz parte do nosso conjunto de designs premium.';
        let waMsg = `Olá! Gostaria de liberar o modelo de QR Code "${model.name}" para meu cartão digital.`;

        if (reason === 'size') {
            const size = parseInt(els.cardForm.qrSize.value);
            cost = PricingModel.getSizeCost(size);
            title = 'Tamanho Premium';
            desc = `O tamanho selecionado (${size}px) é um recurso avançado para impressões de alta qualidade.`;
            waMsg = `Olá! Gostaria de liberar o tamanho ${size}px para meu QR Code.`;
        } else if (reason === 'limit') {
            cost = PricingModel.COSTS.EXTRA_LINK;
            title = 'Limite de QR Codes';
            desc = `Você atingiu o limite de ${PricingModel.LIMITS.FREE_LINKS} QR Codes gratuitos. Ative um novo slot para continuar.`;
            waMsg = `Olá! Gostaria de liberar um novo slot para mais um QR Code no meu plano.`;
        }

        const formattedCost = cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        if (els.planSummary) {
            els.planSummary.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span><strong>Recurso:</strong> ${title}</span>
                    <span style="color:var(--primary); font-weight:700; font-size:1.1rem;">${formattedCost}</span>
                </div>
                <div style="margin-top:0.5rem; font-size:0.85rem; color:var(--text-dim);">
                    <i class="fas fa-info-circle"></i> ${desc}
                </div>
            `;
        }

        if (els.btnWhatsapp) {
            els.btnWhatsapp.href = `https://wa.me/5588933005519?text=${encodeURIComponent(waMsg + ` (Valor: ${formattedCost})`)}`;
        }

        els.blockModal.classList.remove('hidden');
    }
}


if (els.okBlockModal) els.okBlockModal.onclick = () => els.blockModal.classList.add('hidden');
if (els.closeBlockModal) els.closeBlockModal.onclick = () => els.blockModal.classList.add('hidden');



function proceedToCreation() {
    els.modelsView.classList.add('hidden');
    els.creationView.classList.remove('hidden');

    els.selectedPreview.innerHTML = `
        <h3 style="margin-bottom:1rem;">Modelo: ${selectedModel.name}</h3>
        <div class="qr-wrapper ${'qr-' + selectedModel.id}" style="display:inline-block;">
            <canvas id="finalPreviewCanvas"></canvas>
        </div>
    `;

    setTimeout(async () => {
        try {
            await drawQRCode('finalPreviewCanvas', 'https://meuqrcode.com', {
                width: 200,
                ...selectedModel.options
            });
        } catch (err) {
            console.error('Error drawing final QR:', err);
        }
    }, 50);
}

if (els.btnBackModels) {
    els.btnBackModels.onclick = () => {
        els.creationView.classList.add('hidden');
        els.modelsView.classList.remove('hidden');
    };
}

if (els.btnCancelCardForm) {
    els.btnCancelCardForm.onclick = () => {
        els.creationView.classList.add('hidden');
        els.modelsView.classList.remove('hidden');
    };
}

// Form Field Interactions
els.contentType?.addEventListener('change', (e) => {
    if (e.target.value === 'pix') {
        els.pixFields.classList.remove('hidden');
        els.destinationGroup.classList.add('hidden');
    } else {
        els.pixFields.classList.add('hidden');
        els.destinationGroup.classList.remove('hidden');
    }
});

els.fixedUser?.addEventListener('input', (e) => { e.target.value = toSlug(e.target.value); });
els.fixedSlug?.addEventListener('input', (e) => { e.target.value = toSlug(e.target.value); });

// Form Submission
els.cardForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUserId || !selectedModel) return;

    const formData = new FormData(els.cardForm);
    const data = Object.fromEntries(formData.entries());

    // Payment/VIP Verification
    if (!isVipUser()) {
        // 1. Check Link Limit
        try {
            const myQRs = await QRController.mine(currentUserId);
            if (myQRs.length >= PricingModel.LIMITS.FREE_LINKS) {
                showPremiumBlock(selectedModel, 'limit');
                return;
            }
        } catch (err) { console.error('Limit check error:', err); }

        // 2. Check Paid Size
        const sizeCost = PricingModel.getSizeCost(data.qrSize);
        if (sizeCost > 0) {
            showPremiumBlock(selectedModel, 'size');
            return;
        }
    }

    try {

        const btnSave = document.getElementById('btnSaveCard');
        btnSave.disabled = true;
        btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando...';

        let destination = data.destination;
        if (data.contentType === 'pix') {
            destination = buildPixPayload({
                pixKey: data.pixKey,
                merchantName: data.merchantName,
                merchantCity: data.merchantCity,
                amount: data.amount,
                txid: '***',
                description: ''
            });
        }

        const publicId = `${data.fixedUser}/${data.fixedSlug}`;

        const qrRecord = {
            title: data.title,
            contentType: data.contentType,
            destination: destination,
            publicId: publicId,
            ownerId: currentUserId,
            active: data.active === 'on',
            qrSize: parseInt(data.qrSize),
            qrFormat: data.qrFormat,
            qrStyle: selectedModel.id, // Store which model was chosen
            styleOptions: selectedModel.options,
            createdAt: new Date().toISOString()
        };

        await QRController.create(qrRecord);
        showAlert(els.alert, 'Cartão/QR Code criado com sucesso!', 'success');

        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);

    } catch (error) {
        console.error('Error creating card:', error);
        showAlert(els.alert, 'Erro ao criar cartão: ' + error.message, 'error');
    } finally {
        const btnSave = document.getElementById('btnSaveCard');
        btnSave.disabled = false;
        btnSave.innerHTML = '<i class="fas fa-save"></i> Criar Cartão';
    }
});



// Sidebar Logic (Replicated from dashboard)
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const sidebar = document.querySelector('.sidebar');
const mainContent = document.querySelector('.main-content');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebarOverlay = document.getElementById('sidebarOverlay');

if (toggleSidebarBtn && sidebar && mainContent) {
    toggleSidebarBtn.onclick = () => {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
        localStorage.setItem('sidebarState', sidebar.classList.contains('collapsed') ? 'collapsed' : 'expanded');
    };
}

if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.onclick = () => {
        sidebar.classList.toggle('active');
        sidebarOverlay?.classList.toggle('active');
    };
    sidebarOverlay.onclick = () => {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
    };
}

// Restore sidebar state
const savedSidebarState = localStorage.getItem('sidebarState');
if (savedSidebarState === 'collapsed' && sidebar && mainContent) {
    sidebar.classList.add('collapsed');
    mainContent.classList.add('expanded');
}

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await logoutUser();
    window.location.replace('../login.html');
});
