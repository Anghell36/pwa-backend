import express from "express";
import Stripe from "stripe";
import cors from "cors";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const app = express();

// ==========================================
// CONFIGURACIÓN DE MIDDLEWARE (CRÍTICO PARA IMÁGENES)
// ==========================================
app.use(cors({ origin: '*' }));
// Analítico: Aumentamos el límite a 10MB para que las fotos de las mascotas no den error 413
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ==========================================
// 1. CONEXIÓN A LA BASE DE DATOS (MONGODB)
// ==========================================
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("¡Conectado a MongoDB exitosamente!"))
    .catch((err) => console.error("Error conectando a MongoDB:", err));

// ==========================================
// 2. ESTRUCTURA DE LOS DATOS (MODELOS)
// ==========================================

const petSchema = new mongoose.Schema({
    name: String,
    breed: String,
    color: String,
    genre: String,
    age: String,
    desc: String,
    image: String, // Aquí se guarda el string Base64 de la foto
    ownerId: String, // ID del usuario que creó la mascota
    createdAt: { type: Date, default: Date.now }
});
const Pet = mongoose.model("Pet", petSchema);

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    fullName: { type: String, required: true },
    password: { type: String, required: true }
});
const User = mongoose.model("User", userSchema);

// ==========================================
// 3. RUTAS DE AUTENTICACIÓN
// ==========================================

app.post("/register", async (req, res) => {
    try {
        const { email, username, fullName, password } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: "El correo ya está registrado." });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ email, username, fullName, password: hashedPassword });
        await newUser.save();
        
        res.status(201).json({ message: "Usuario creado", userId: newUser._id });
    } catch (error) {
        res.status(500).json({ error: "Error al registrar el usuario" });
    }
});

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Contraseña incorrecta" });

        res.status(200).json({ message: "Login exitoso", userId: user._id });
    } catch (error) {
        res.status(500).json({ error: "Error en el servidor al iniciar sesión" });
    }
});

// ==========================================
// 4. API DE MASCOTAS (CON DUEÑO)
// ==========================================

app.get("/pets", async (req, res) => {
    try {
        const pets = await Pet.find().sort({ createdAt: -1 });
        res.status(200).json(pets);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener mascotas" });
    }
});

app.post("/pets", async (req, res) => {
    try {
        // Analítico: req.body ya trae el ownerId desde el frontend
        const newPet = new Pet(req.body);
        const savedPet = await newPet.save();
        res.status(201).json(savedPet);
    } catch (error) {
        res.status(500).json({ error: "Error al guardar la mascota" });
    }
});

// ==========================================
// 5. RUTAS DE PAGOS (STRIPE)
// ==========================================
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.post("/create-payment-intent", async (req, res) => {
    try {
        const { amount } = req.body;
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount, 
            currency: "mxn",
            automatic_payment_methods: { enabled: true },
        });
        res.send({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        res.status(400).send({ error: error.message });
    }
});

export default app;