import { QRController } from '../controllers/qrController.js';
import { toggleState } from '../views/ui.js';

// tenta primeiro pegar ?id=..., se não tiver usa o path depois do domínio
const params = new URLSearchParams(window.location.search);
let id = params.get('id');

if (!id) {
  // ex.: /page/anselmo/catalogo ou /anselmo/catalogo
  const path = window.location.pathname
    .replace(/^\/page\//, '') // remove /page/ se existir
    .replace(/^\//, '')       // remove barra inicial
    .replace(/\/$/, '');      // remove barra final
  id = path || null;
}

// UI removida: redireciona silenciosamente sem mostrar estado visual

(async function resolveQRCode() {
  const sections = {
    loading: document.getElementById('loading'),
    inactive: document.getElementById('inactive'),
    notfound: document.getElementById('notfound'),
    error: document.getElementById('error')
  };

  if (!id) {
    toggleState(sections.notfound, true);
    return;
  }

  toggleState(sections.loading, true);
  try {
    const record = await QRController.findByPublicId(id);
    if (!record) {
      toggleState(sections.loading, false);
      toggleState(sections.notfound, true);
      return;
    }
    if (!record.active) {
      toggleState(sections.loading, false);
      toggleState(sections.inactive, true);
      return;
    }
    if (record.destination) {
      const v = (record.destination || '').trim();
      const isUrl = /^https?:\/\//i.test(v) || /^[\w.-]+\.[a-z]{2,}([\/\?#].*)?$/i.test(v);
      if (isUrl) {
        window.location.replace(v.startsWith('http') ? v : `https://${v}`);
        return;
      }
      showContent(v);
      toggleState(sections.loading, false);
      return;
    }
    toggleState(sections.loading, false);
    toggleState(sections.error, true);
  } catch (error) {
    console.error(error);
    toggleState(sections.loading, false);
    toggleState(sections.error, true);
  }
})();

function showContent(value) {
  const container = document.getElementById('content');
  if (!container) return;
  container.querySelector('#contentValue').textContent = value;
  const action = container.querySelector('#contentAction');
  if (/^[a-z]+:/i.test(value)) {
    action.href = value;
    action.classList.remove('hidden');
  } else {
    action.classList.add('hidden');
  }
  toggleState(container, true);
}
