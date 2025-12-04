import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAXDQpDuPMYsxMJVYbvPquhiqQdkcqJrmI',
  authDomain: 'qrcode-link-5f95e.firebaseapp.com',
  projectId: 'qrcode-link-5f95e',
  storageBucket: 'qrcode-link-5f95e.firebasestorage.app',
  messagingSenderId: '1007102119114',
  appId: '1:1007102119114:web:1f776e6a8ff4976c5ab833',
  measurementId: 'G-4Z7HHHBQWZ'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
