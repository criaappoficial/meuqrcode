const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { MercadoPagoConfig, Preference } = require("mercadopago");
const cors = require("cors")({ origin: true });

admin.initializeApp();

// Test Access Token (replace with production token when going live)
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "APP_USR-1425166093599192-071000-a564f028752f9b275f64f7e9a4eb716e-147885044";

const client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN, options: { timeout: 5000 } });

exports.createPreference = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).send('Method Not Allowed');
        }

        try {
            const { title, unit_price, quantity = 1, userId, itemId } = req.body;

            if (!title || !unit_price || !userId) {
                return res.status(400).json({ error: "Missing required fields: title, unit_price, userId" });
            }

            // 1. Create Preference payload
            const preference = new Preference(client);

            const body = {
                items: [
                    {
                        id: itemId || "premium_feature",
                        title: title,
                        quantity: Number(quantity),
                        unit_price: Number(unit_price),
                        currency_id: "BRL",
                    },
                ],
                metadata: {
                    user_id: userId,
                    item_id: itemId || "premium_feature"
                },
                back_urls: {
                    success: "https://meuqrcode.com/page/dashboard.html?payment=success",
                    failure: "https://meuqrcode.com/page/dashboard.html?payment=failure",
                    pending: "https://meuqrcode.com/page/dashboard.html?payment=pending",
                },
                // Block debit card, prepaid card and atm
                payment_methods: {
                    excluded_payment_types: [
                        { id: "debit_card" },
                        { id: "prepaid_card" },
                        { id: "atm" }
                    ],
                    installments: 12
                },
                auto_return: "approved",
            };

            // 2. Call MP API
            const result = await preference.create({ body });

            // 3. Return the Preference ID to the frontend
            res.status(200).json({ id: result.id, init_point: result.init_point });

        } catch (error) {
            console.error("Error creating preference:", error);
            res.status(500).json({ error: "Failed to create preference" });
        }
    });
});

exports.mercadopagoWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
    }

    const topic = req.query.topic || req.body.type;

    if (topic === "payment") {
        const paymentId = req.query.id || req.body.data?.id;

        if (!paymentId) return res.status(400).send("Missing payment id");

        try {
            console.log(`Payment webhook received for ID: ${paymentId}`);

            const { Payment } = require('mercadopago');
            const paymentClient = new Payment(client);
            const paymentInfo = await paymentClient.get({ id: paymentId });

            if (paymentInfo) {
                const userId = paymentInfo.metadata?.user_id;
                const status = paymentInfo.status;
                const amount = paymentInfo.transaction_amount;
                const dateCreated = paymentInfo.date_created;
                const itemId = paymentInfo.metadata?.item_id;

                console.log(`Payment status for ${paymentId}: ${status}`);

                // Store in payments collection
                const paymentData = {
                    paymentId: String(paymentId),
                    userId: userId || 'unknown',
                    itemId: itemId || 'premium_feature',
                    status: status,
                    amount: amount,
                    currency: paymentInfo.currency_id,
                    dateCreated: dateCreated,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    rawStatus: paymentInfo.status_detail
                };

                await admin.firestore().collection("payments").doc(String(paymentId)).set(paymentData, { merge: true });

                if (status === 'approved' && userId) {
                    await admin.firestore().collection("users").doc(userId).update({
                        isVip: true,
                        lastPaymentId: String(paymentId),
                        vipUntil: admin.firestore.FieldValue.serverTimestamp() // Simplification: set it to now or handle subscription logic
                    });
                }
            }

            res.status(200).send("OK");
        } catch (error) {
            console.error("Webhook error:", error);
            res.status(500).send("Error processing webhook");
        }
    } else {
        res.status(200).send("Handling non-payment topic: " + topic);
    }
});
