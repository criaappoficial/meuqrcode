import { db } from '../core/firebase.js';
import {
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const qrCollection = collection(db, 'qrcodes');

const slugify = (value) =>
  (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');

export async function createQRCodeRecord({ title, destination, active = true, id: fixedId, fixedUrl, ownerId, style }) {
  const id = slugify(fixedId) || slugify(title) || `link-${Date.now()}`;
  const docId = id.replace(/\//g, '__');
  const payload = {
    id,
    fixedUrl: fixedUrl || null,
    title,
    destination,
    active,
    ownerId: ownerId || null,
    style: style || 'default',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  // documento salvo com o próprio id como ID do doc
  await setDoc(doc(db, 'qrcodes', docId), payload);
  return payload;
}

export async function updateQRCodeRecord(docId, { title, destination, active, ownerId }) {
  const ref = doc(db, 'qrcodes', docId);
  const payload = { updatedAt: serverTimestamp() };
  if (typeof title !== 'undefined') payload.title = title;
  if (typeof destination !== 'undefined') payload.destination = destination;
  if (typeof active !== 'undefined') payload.active = active;
  if (typeof ownerId !== 'undefined') payload.ownerId = ownerId;
  await updateDoc(ref, payload);
  return true;
}

export async function deleteQRCodeRecord(docId) {
  const ref = doc(db, 'qrcodes', docId);
  await deleteDoc(ref);
}

export async function getQRCodeRecord(docId) {
  const ref = doc(db, 'qrcodes', docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { docId: snap.id, ...snap.data() };
}

// agora busca direto pelo ID do documento (que é o mesmo campo id)
export async function getQRCodeRecordByPublicId(id) {
  const q = query(qrCollection, where('id', '==', id));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const docSnap = snapshot.docs[0];
  return { docId: docSnap.id, ...docSnap.data() };
}

export async function listQRCodes() {
  const snapshot = await getDocs(query(qrCollection, orderBy('createdAt', 'desc')));
  return snapshot.docs.map((docSnap) => ({ docId: docSnap.id, ...docSnap.data() }));
}

export async function listQRCodesByOwner(ownerId) {
  const snapshot = await getDocs(query(qrCollection, where('ownerId', '==', ownerId)));
  return snapshot.docs.map((docSnap) => ({ docId: docSnap.id, ...docSnap.data() }));
}
