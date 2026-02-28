const { MercadoPagoConfig, Preference } = require('mercadopago');

exports.handler = async (event, context) => {
    // Only allow POST requests
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
                body: JSON.stringify({ error: "MP_ACCESS_TOKEN environment variable not set on Netlify" })
            };
        }

        const client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });
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
            auto_return: "approved",
        };

        const result = await preference.create({ body });

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: result.id, init_point: result.init_point })
        };
    } catch (error) {
        console.error("Error creating preference:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to create preference", details: error.message })
        };
    }
};
