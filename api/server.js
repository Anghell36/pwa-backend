import express from "express";
import Stripe from "stripe";
import cors from "cors";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// ==========================================
// 1. CONEXIÓN A LA BASE DE DATOS (MONGODB)
// ==========================================
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("¡Conectado a MongoDB exitosamente!"))
    .catch((err) => console.error("Error conectando a MongoDB:", err));

// ==========================================
// 2. ESTRUCTURA DE LOS DATOS (MODELO)
// ==========================================
// Así le decimos a Mongo qué datos lleva una mascota
const petSchema = new mongoose.Schema({
    name: String,
    color: String,
    genre: String,
    age: String,
    desc: String,
    image: String,
    createdAt: { type: Date, default: Date.now } // Guarda la fecha automáticamente
});

const Pet = mongoose.model("Pet", petSchema);

// ==========================================
// ESTRUCTURA DE USUARIOS (MODELO)
// ==========================================
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model("User", userSchema);

// ==========================================
// RUTAS DE AUTENTICACIÓN (LOGIN / REGISTRO)
// ==========================================

// Registrar un nuevo usuario
app.post("/register", async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Verificar si ya existe
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: "El correo ya está registrado." });

        // Encriptar la contraseña y guardar
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ email, password: hashedPassword });
        await newUser.save();
        
        res.status(201).json({ message: "Usuario creado", userId: newUser._id });
    } catch (error) {
        res.status(500).json({ error: "Error al registrar el usuario" });
    }
});

// Iniciar sesión
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Buscar al usuario
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

        // Comparar contraseñas
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Contraseña incorrecta" });

        res.status(200).json({ message: "Login exitoso", userId: user._id });
    } catch (error) {
        res.status(500).json({ error: "Error en el servidor al iniciar sesión" });
    }
});

// ==========================================
// 3. RUTAS DE LA APLICACIÓN (API DE MASCOTAS)
// ==========================================

// Ruta para OBTENER todas las mascotas (GET)
app.get("/pets", async (req, res) => {
    try {
        const pets = await Pet.find().sort({ createdAt: -1 }); // Las más nuevas primero
        res.status(200).json(pets);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener mascotas" });
    }
});

// Ruta para GUARDAR una nueva mascota (POST)
app.post("/pets", async (req, res) => {
    try {
        const newPet = new Pet(req.body);
        const savedPet = await newPet.save();
        res.status(201).json(savedPet);
    } catch (error) {
        res.status(500).json({ error: "Error al guardar la mascota" });
    }
});

// ==========================================
// 4. RUTAS DE PAGOS (STRIPE)
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