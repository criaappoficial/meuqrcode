# 📱 QR Code Alugueja

Sistema completo de gerenciamento de QR Codes dinâmicos usando **HTML**, **CSS**, **JavaScript puro** e **Firebase**.

## ✨ Funcionalidades

- 🔐 Autenticação Firebase Auth (email/senha)
- 📝 CRUD completo de QR Codes
- 🔄 QR Codes dinâmicos com redirecionamento em `/page/?id=`
- 📥 Download dos QR Codes em PNG
- 🎨 Interface moderna e responsiva
- 🔒 Regras de segurança no Firestore

## 🚀 Como Configurar

1. Clone ou copie os arquivos deste diretório
2. Configure o Firebase seguindo o guia `SETUP.md`
3. Preencha `firebase.js` (já configurado com seu projeto)
4. Inicie um servidor HTTP local (veja abaixo)

## 📁 Estrutura em camadas (MVC)
```
.
├── assets/
│   ├── css/styles.css                  # Camada de View (design)
│   └── js/
│       ├── core/firebase.js            # Boot Firebase
│       ├── models/qrModel.js           # Model (Firestore)
│       ├── controllers/
│       │   ├── authController.js
│       │   └── qrController.js
│       ├── views/ui.js                 # Helpers visuais
│       └── pages/                      # Controllers específicos da View
│           ├── login.js
│           ├── dashboard.js
│           ├── new.js
│           ├── edit.js
│           └── redirect.js
├── index.html                          # View pública (login)
├── page/
│   ├── dashboard.html                  # Painel autenticado
│   ├── new.html                        # Criação de QR
│   ├── edit.html                       # Edição de QR
│   └── index.html                      # Página pública para QR dinâmico
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── README.md
└── SETUP.md
```

## 🛠️ Rodar Localmente

```bash
python3 -m http.server 8000
# ou
npx http-server -p 8000
# ou
firebase serve
```

Acesse: `http://localhost:8000`

## 📦 Deploy Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## 🔄 QR Dinâmico

- Cada QR Code pode apontar para `https://seudominio.com/page/?id=ID`
- A página `/page/` consulta o Firestore e redireciona para `destination`
- Alterar o destino no painel atualiza o comportamento sem gerar novo QR

## 🔒 Segurança

Regras `firestore.rules` garantem:
- Escrita apenas por usuários autenticados
- Leitura pública para permitir os redirecionamentos

## 🐛 Troubleshooting

- **auth/user-not-found**: crie o usuário na aba Authentication
- **Permission denied**: revise as regras do Firestore e o login
- **QR sem redirecionar**: verifique se está ativo e se o destino é válido

## 📄 Licença

Uso livre. Melhorias e contribuições são bem-vindas!
