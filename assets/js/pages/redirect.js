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

const sections = {
  loading: document.getElementById('loading'),
  inactive: document.getElementById('inactive'),
  notfound: document.getElementById('notfound'),
  error: document.getElementById('error')
};

(async function resolveQRCode() {
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
      window.location.replace(record.destination);
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
