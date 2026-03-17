import express from "express";
import Stripe from "stripe";
import cors from "cors";

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.post("/create-payment-intent", async (req, res) => {
    try {
        const { amount } = req.body;
        
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount, // En centavos. 5000 = $50.00 MXN
            currency: "mxn", // <--- CAMBIADO A PESOS MEXICANOS
            automatic_payment_methods: { enabled: true },
        });

        res.send({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});

export default app;