import { db, auth } from '../core/firebase.js';
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

export async function createQRCodeRecord({ title, destination, active = true, id: fixedId, fixedUrl, options = {} }) {
  const user = auth.currentUser;
  if (!user) throw new Error('Usuário não autenticado');

  const id = slugify(fixedId) || slugify(title) || `link-${Date.now()}`;
  const docId = id.replace(/\//g, '__');
  const payload = {
    id,
    userId: user.uid,
    fixedUrl: fixedUrl || null,
    title,
    destination,
    active,
    options: {
      size: options.size || 320,
      colors: options.colors || { dark: '#000000', light: '#ffffff' },
      isCustomColor: options.isCustomColor || false
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  // documento salvo com o próprio id como ID do doc
  await setDoc(doc(db, 'qrcodes', docId), payload);
  return payload;
}

export async function updateQRCodeRecord(docId, { title, destination, active, options }) {
  const ref = doc(db, 'qrcodes', docId);
  const updatePayload = {
    title,
    destination,
    active,
    updatedAt: serverTimestamp()
  };
  if (options) {
    updatePayload.options = options;
  }
  await updateDoc(ref, updatePayload);
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
  const user = auth.currentUser;
  if (!user) return [];

  // Tenta buscar por userId (novos registros)
  const q = query(
    qrCollection, 
    where('userId', '==', user.uid),
    orderBy('createdAt', 'desc')
  );

  let snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({ docId: docSnap.id, ...docSnap.data() }));
}
