import { auth } from '../core/firebase.js';
import { createUserProfile, getUserProfile, deleteUserProfile } from '../models/userModel.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';


export async function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function registerWithEmail(email, password) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  console.log('Usuário criado no Auth, criando perfil no Firestore...');

  // Cria o perfil do usuário com isAdmin: false
  try {
    await createUserProfile(user.uid, {
      email: user.email
    });
    console.log('Perfil criado com sucesso!');
  } catch (error) {
    console.error('Erro CRÍTICO ao criar perfil do usuário:', error);
    alert(`Atenção: Usuário criado, mas houve erro ao salvar dados adicionais: ${error.message}\nVerifique as Regras de Segurança no Firebase Console.`);
    throw error;
  }

  return userCredential;
}

export async function logoutUser() {
  return signOut(auth);
}

export async function deleteCurrentUser() {
  const user = auth.currentUser;
  if (user) {
    // 1. Deleta o perfil no Firestore (users/{uid})
    try {
      await deleteUserProfile(user.uid);
      console.log('Perfil Firestore deletado.');
    } catch (e) {
      console.error('Erro ao deletar perfil Firestore (pode não existir):', e);
      // Não impede a deleção da conta Auth se o perfil já não existir
    }

    // 2. Deleta a conta de autenticação
    // Nota: Se o login for antigo, o Firebase pode pedir re-login (error code: auth/requires-recent-login).
    // Isso é tratado no catch do dashboard.js
    await deleteUser(user);
  }
}

export async function updateAuthProfile(data) {
  const user = auth.currentUser;
  if (!user) throw new Error('Usuário não autenticado');
  return updateProfile(user, data);
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

// Exporta a função para verificar admin
export { getUserProfile };
