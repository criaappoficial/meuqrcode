# 🚀 Guia Rápido de Configuração

## 1. Projeto Firebase
1. Acesse https://console.firebase.google.com/
2. Crie (ou escolha) um projeto
3. Adicione um app Web e copie as credenciais (já aplicadas em `assets/js/core/firebase.js`)

## 2. Authentication
1. Menu **Authentication** → **Começar**
2. Aba **Sign-in method**
3. Ative **Email/Password** e salve
4. Aba **Users** → **Add user** → informe email e senha para o primeiro acesso

## 3. Firestore
1. Menu **Firestore Database** → **Criar banco de dados**
2. Escolha o modo de produção ou teste
3. Na aba **Rules**, copie o conteúdo de `firestore.rules`
4. Publique as regras

## 4. Rodar Localmente
```bash
python3 -m http.server 8000
# ou
npx http-server -p 8000
```
Acesse `http://localhost:8000` e faça login com o usuário criado.

## 5. Deploy (Opcional)
```bash
npm install -g firebase-tools
firebase login
firebase deploy
```

## Checklist
- [ ] Authentication ativa e usuário criado
- [ ] Firestore criado com regras atualizadas
- [ ] `assets/js/core/firebase.js` apontando para seu projeto
- [ ] Servidor local rodando
- [ ] Login realizado com sucesso

Pronto! O sistema de QR Codes está configurado.
