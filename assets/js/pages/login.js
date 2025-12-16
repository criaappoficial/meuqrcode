import { observeAuth, loginWithEmail, registerWithEmail } from '../controllers/authController.js';
import { showAlert } from '../views/ui.js';

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
    const message = mapError(error?.code);
    showAlert(alertContainer, message, 'error');
    btnText.textContent = 'Entrar';
    loader.classList.add('hidden');
    submitBtn.disabled = false;
  }
});

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
    await registerWithEmail(email, password);
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
    default: return 'Não foi possível processar a requisição. Tente novamente.';
  }
}
