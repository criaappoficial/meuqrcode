import { auth } from '../core/firebase.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

export async function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function registerWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function logoutUser() {
  return signOut(auth);
}

export function observeAuth(onAuth, onUnauth) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      onAuth?.(user);
    } else {
      onUnauth?.();
    }
  });
}
