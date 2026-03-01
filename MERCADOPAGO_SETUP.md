# 💳 Configuração do Checkout Mercado Pago

Guia completo de como o checkout foi integrado ao projeto MeuQRCode.

---

## Visão Geral da Arquitetura

```
Frontend (Netlify)  →  Netlify Function  →  API Mercado Pago
                   ←  { id, init_point }  ←
```

O frontend **não fala diretamente** com a API do Mercado Pago para criar pagamentos (por segurança). Em vez disso, chama uma **Netlify Function** que guarda o token secreto e faz a chamada autenticada.

---

## 📁 Arquivos Criados

```
meuqrcode/
├── netlify.toml                          ← Configuração do Netlify
└── netlify/
    └── functions/
        ├── package.json                  ← Dependências das functions
        ├── createPreference.js           ← Cria o pagamento no MP
        └── mercadopagoWebhook.js         ← Recebe notificações do MP
```

---

## Passo 1 — Criar a Netlify Function

### `netlify/functions/createPreference.js`

```js
const { MercadoPagoConfig, Preference } = require('mercadopago');

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { title, unit_price, quantity = 1, userId, itemId } = JSON.parse(event.body);

    if (!title || !unit_price || !userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields: title, unit_price, userId" })
      };
    }

    const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    if (!MP_ACCESS_TOKEN) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "MP_ACCESS_TOKEN not set on Netlify" })
      };
    }

    const client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [{
          id: itemId || "premium_feature",
          title,
          quantity: Number(quantity),
          unit_price: Number(unit_price),
          currency_id: "BRL",
        }],
        metadata: { user_id: userId, item_id: itemId || "premium_feature" },
        back_urls: {
          success: "https://meuqrcode.com/page/dashboard.html?payment=success",
          failure: "https://meuqrcode.com/page/dashboard.html?payment=failure",
          pending: "https://meuqrcode.com/page/dashboard.html?payment=pending",
        },
        payment_methods: {
          excluded_payment_types: [
            { id: "debit_card" },
            { id: "prepaid_card" },
            { id: "atm" }
          ],
          installments: 12,
        },
        auto_return: "approved",
      }
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: result.id, init_point: result.init_point })
    };

  } catch (error) {
    console.error("Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
```

### `netlify/functions/package.json`

```json
{
  "name": "netlify-functions",
  "version": "1.0.0",
  "dependencies": {
    "mercadopago": "^2.12.0"
  }
}
```

### `netlify/functions/mercadopagoWebhook.js`

```js
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  try {
    const body = JSON.parse(event.body || "{}");
    const topic = event.queryStringParameters?.topic || body.type;
    if (topic === "payment") {
      const paymentId = event.queryStringParameters?.id || body.data?.id;
      console.log(`Webhook received for payment ID: ${paymentId}`);
      // TODO: atualizar Firestore com firebase-admin se necessário
    }
    return { statusCode: 200, body: "OK" };
  } catch (error) {
    return { statusCode: 500, body: "Error" };
  }
};
```

---

## Passo 2 — Configurar o `netlify.toml`

Na raiz do projeto:

```toml
[build]
  publish = "."
  functions = "netlify/functions"

[[plugins]]
  package = "@netlify/plugin-functions-install-core"

[functions]
  node_bundler = "esbuild"

[[redirects]]
  from = "/page/dashboard.html"
  to = "/page/dashboard.html"
  status = 200

[[redirects]]
  from = "/page/*"
  to = "/page/index.html"
  status = 200

[[redirects]]
  from = "/*"
  to = "/page/index.html"
  status = 200
```

> **Importante:** O plugin `@netlify/plugin-functions-install-core` é necessário para o Netlify instalar automaticamente o `mercadopago` do `package.json` da função.

---

## Passo 3 — Chamar a função no Frontend

Nos arquivos `dashboard.js` e `create-card.js`, use detecção de ambiente:

```js
const apiUrl = window.location.hostname === 'localhost'
  ? 'http://localhost:5002/createPreference'   // Desenvolvimento local
  : '/.netlify/functions/createPreference';    // Produção (Netlify)

const response = await fetch(apiUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Plano Premium',
    unit_price: 29.90,
    quantity: 1,
    userId: currentUserId,
    itemId: 'premium_subscription'
  })
});

const data = await response.json();

if (data.id) {
  const mp = new MercadoPago('SUA_PUBLIC_KEY_AQUI', { locale: 'pt-BR' });
  mp.checkout({ preference: { id: data.id }, autoOpen: true });
}
```

---

## Passo 4 — Configurar Variável de Ambiente no Netlify

> [!IMPORTANT]
> Este passo é **obrigatório**. Sem ele, a função retorna erro 500.

1. Acesse [app.netlify.com](https://app.netlify.com)
2. Selecione o seu site
3. Clique em **"Project configuration"** (menu lateral esquerdo)
4. Clique em **"Environment variables"**
5. Clique em **"Add a variable"** → **"Add a single variable"**
6. Preencha:
   - **Key:** `MP_ACCESS_TOKEN`
   - **Value:** seu token do Mercado Pago
7. Clique em **Save**
8. Vá em **Deploys** → **Trigger deploy** → **Deploy site**

---

## Passo 5 — Testar Localmente (Opcional)

Para testar sem fazer deploy, use o servidor local em `functions/`:

```bash
cd functions
node server.js
# ✅ API Local rodando em: http://localhost:5002
```

Quando `localhost`, o frontend já detecta automaticamente e usa a porta 5002.

---

## 🔑 Chaves do Mercado Pago

| Tipo | Onde usar | Onde obter |
|------|-----------|------------|
| **Public Key** (`APP_USR-xxxx`) | Frontend (JS) | Painel MP → Credenciais |
| **Access Token** (`APP_USR-xxxx`) | Backend / Env var Netlify | Painel MP → Credenciais |

> As credenciais de **teste** e **produção** são diferentes. Certifique-se de usar as credenciais de produção ao publicar para usuários reais.

---

## Fluxo Completo do Pagamento

```
1. Usuário clica em "Assinar"
2. Frontend chama /.netlify/functions/createPreference
3. Netlify Function usa MP_ACCESS_TOKEN para criar uma Preference na API do MP
4. MP retorna { id, init_point }
5. Frontend abre o checkout do MP com mp.checkout({ preference: { id } })
6. Usuário paga no modal do Mercado Pago
7. MP redireciona para back_urls.success/failure/pending
8. MP notifica /.netlify/functions/mercadopagoWebhook (webhook)
```
