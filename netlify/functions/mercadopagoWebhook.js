exports.handler = async (event, context) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const body = JSON.parse(event.body || "{}");
        const topic = event.queryStringParameters?.topic || body.type;

        if (topic === "payment") {
            const paymentId = event.queryStringParameters?.id || body.data?.id;
            console.log(`Webhook received for payment ID: ${paymentId}`);

            // TODO: use firebase-admin to update Firestore if FIREBASE_SERVICE_ACCOUNT env var is set
            // For now, this endpoint just acknowledges the webhook successfully.
        }

        return { statusCode: 200, body: "OK" };
    } catch (error) {
        console.error("Webhook error:", error);
        return { statusCode: 500, body: "Error processing webhook" };
    }
};
