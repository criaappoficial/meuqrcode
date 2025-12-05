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

export function drawQRCode(canvasId, value) {
  return new Promise((resolve, reject) => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return reject(new Error('Canvas não encontrado'));
    QRCode.toCanvas(canvas, value, {
      width: 320,
      margin: 1,
      color: { dark: '#050814', light: '#FFFFFF' }
    }, (error) => error ? reject(error) : resolve(canvas));
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
