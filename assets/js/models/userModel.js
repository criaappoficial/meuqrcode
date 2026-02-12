import { db } from '../core/firebase.js';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

export async function createUserProfile(uid, data = {}) {
  const userRef = doc(db, 'users', uid);
  // Garante que isAdmin seja false por padrão se não for fornecido
  const payload = {
    isAdmin: false,
    createdAt: new Date(),
    ...data
  };
  await setDoc(userRef, payload, { merge: true });
  return payload;
}

export async function getUserProfile(uid) {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;
  return snap.data();
}

export async function updateUserProfile(uid, data) {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, data);
}

export async function deleteUserProfile(uid) {
  const userRef = doc(db, 'users', uid);
  await deleteDoc(userRef);
}
