import {
  createQRCodeRecord,
  updateQRCodeRecord,
  deleteQRCodeRecord,
  getQRCodeRecord,
  getQRCodeRecordByPublicId,
  listQRCodes,
  listQRCodesByOwner
} from '../models/qrModel.js';

export const QRController = {
  create: (payload) => createQRCodeRecord(payload),
  update: (docId, payload) => updateQRCodeRecord(docId, payload),
  remove: (docId) => deleteQRCodeRecord(docId),
  find: (docId) => getQRCodeRecord(docId),
  findByPublicId: (id) => getQRCodeRecordByPublicId(id),
  all: () => listQRCodes(),
  mine: (ownerId) => listQRCodesByOwner(ownerId)
};

export function drawQRCode(canvasId, value, opts = {}) {
  return new Promise((resolve, reject) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return reject(new Error('Canvas não encontrado'));
    const options = Object.assign({ width: 320, margin: 1, color: { dark: '#050814', light: '#FFFFFF' } }, opts);
    QRCode.toCanvas(canvas, value, options, (error) => error ? reject(error) : resolve(canvas));
  });
}

export function downloadQRCode(canvasId, filename = 'qrcode.png') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = filename;
  link.click();
}

export function drawQRCodeSvg(containerId, value, opts = {}) {
  return new Promise((resolve, reject) => {
    const el = document.getElementById(containerId);
    if (!el) return reject(new Error('Container não encontrado'));
    const options = Object.assign({ width: 320, margin: 1, color: { dark: '#050814', light: '#FFFFFF' } }, opts);
    QRCode.toString(value, { type: 'svg', ...options }, (err, string) => {
      if (err) return reject(err);
      el.innerHTML = string;
      resolve(el);
    });
  });
}

export function downloadQRCodeSvg(containerId, filename = 'qrcode.svg') {
  const el = document.getElementById(containerId);
  if (!el) return;
  const svg = el.querySelector('svg');
  if (!svg) return;
  const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
