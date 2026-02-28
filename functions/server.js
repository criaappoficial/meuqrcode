/**
 * Local Express server to test the Mercado Pago integration
 * This mirrors the Firebase Cloud Function behavior locally.
 * Run with: node server.js
 */
const express = require('express');
const cors = require('cors');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "APP_USR-1425166093599192-071000-a564f028752f9b275f64f7e9a4eb716e-147885044";
const client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN, options: { timeout: 5000 } });

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

app.post('/createPreference', async (req, res) => {
    try {
        const { title, unit_price, quantity = 1, userId, itemId } = req.body;
        if (!title || !unit_price || !userId) {
            return res.status(400).json({ error: "Missing required fields: title, unit_price, userId" });
        }

        const preference = new Preference(client);
        const body = {
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
                installments: 12
            },
            auto_return: undefined,
        };

        const result = await preference.create({ body });
        console.log("Preference created:", result.id);
        res.status(200).json({ id: result.id, init_point: result.init_point });
    } catch (error) {
        console.error("Error creating preference:", error?.message || error);
        res.status(500).json({ error: "Failed to create preference" });
    }
});

app.post('/mercadopagoWebhook', async (req, res) => {
    const topic = req.query.topic || req.body.type;
    if (topic === "payment") {
        const paymentId = req.query.id || req.body.data?.id;
        console.log(`Webhook received for payment ID: ${paymentId}`);
        // TODO: verify payment & update Firestore
    }
    res.status(200).send("OK");
});

const PORT = 5002;
app.listen(PORT, () => {
    console.log(`\n✅ API Local rodando em: http://localhost:${PORT}`);
    console.log(`   POST http://localhost:${PORT}/createPreference\n`);
});
