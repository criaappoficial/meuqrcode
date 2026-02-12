import { observeAuth, loginWithEmail, registerWithEmail } from '../controllers/authController.js';
import { showAlert } from '../views/ui.js';
import { db } from '../core/firebase.js'; // Importação direta
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js'; // Importação direta

console.log('Login.js carregado v9 - Iniciando sistema...');

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const alertContainer = document.getElementById('alert-container');

const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('loginBtnText');
const loader = document.getElementById('loginLoading');

const registerSubmit = document.getElementById('registerSubmit');
const registerBtnText = document.getElementById('registerBtnText');
const registerLoader = document.getElementById('registerLoading');

const passwordInput = document.getElementById('passwordInput');
const togglePassword = document.getElementById('togglePassword');
const regPassword = document.getElementById('regPassword');
const toggleRegPassword = document.getElementById('toggleRegPassword');

observeAuth(
  () => window.location.replace('page/dashboard.html'),
  () => {}
);

document.querySelector('.brand-badge')?.addEventListener('click', () => {
  window.location.href = 'index.html';
});


loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = loginForm.email.value;
  const password = loginForm.password.value;

  submitBtn.disabled = true;
  btnText.textContent = 'Entrando...';
  loader.classList.remove('hidden');

  try {
    await loginWithEmail(email, password);
  } catch (error) {
    console.error('Login Error:', error);
    const message = mapError(error?.code);
    showAlert(alertContainer, message, 'error');
    btnText.textContent = 'Entrar';
    loader.classList.add('hidden');
    submitBtn.disabled = false;
  }
});

// Registrar novo usuário
registerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = registerForm.regEmail.value;
  const password = registerForm.regPassword.value;
  const confirm = registerForm.regPasswordConfirm.value;

  if (password.length < 6) {
    showAlert(alertContainer, 'A senha deve ter pelo menos 6 caracteres.', 'error');
    return;
  }

  if (password !== confirm) {
    showAlert(alertContainer, 'As senhas não conferem.', 'error');
    return;
  }

  registerSubmit.disabled = true;
  registerBtnText.textContent = 'Criando conta...';
  registerLoader.classList.remove('hidden');

  try {
    const userCred = await registerWithEmail(email, password);
    const user = userCred.user;

    // TENTATIVA DUPLA: Se o controller falhar, tenta aqui também
    console.log('Tentativa de backup de criação de perfil no login.js...');
    try {
        await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            isAdmin: false,
            createdAt: new Date(),
            backupCreated: true
        }, { merge: true });
        console.log('Perfil criado com sucesso pelo BACKUP do login.js');
    } catch (innerError) {
        console.error('FALHA TAMBÉM NO BACKUP:', innerError);
        alert('ERRO CRÍTICO: Não foi possível salvar seus dados no banco de dados. Verifique o console.');
    }

    // observer vai redirecionar após cadastro
  } catch (error) {
    const message = mapError(error?.code);
    showAlert(alertContainer, message, 'error');
    registerSubmit.disabled = false;
    registerBtnText.textContent = 'Criar conta';
    registerLoader.classList.add('hidden');
  }
});

const goToRegister = document.getElementById('goToRegister');
const goToLogin = document.getElementById('goToLogin');

goToRegister?.addEventListener('click', () => {
  loginForm.classList.add('hidden');
  registerForm.classList.remove('hidden');
});

goToLogin?.addEventListener('click', () => {
  registerForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
});

function attachToggle(btn, input) {
  if (!btn || !input) return;
  btn.addEventListener('click', () => {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.textContent = isPassword ? '🙈' : '👁';
  });
}

attachToggle(togglePassword, passwordInput);
attachToggle(toggleRegPassword, regPassword);

function mapError(code) {
  switch (code) {
    case 'auth/user-not-found': return 'Usuário não encontrado.';
    case 'auth/wrong-password': return 'Senha incorreta.';
    case 'auth/invalid-email': return 'Email inválido.';
    case 'auth/email-already-in-use': return 'Este email já está em uso.';
    case 'auth/invalid-credential': return 'Email ou senha incorretos.';
    case 'auth/invalid-login-credentials': return 'Email ou senha incorretos.';
    case 'auth/too-many-requests': return 'Muitas tentativas falhas. Tente novamente mais tarde.';
    case 'auth/network-request-failed': return 'Erro de conexão. Verifique sua internet.';
    default: return `Erro: ${code || 'Desconhecido'}. Tente novamente.`;
  }
}
