import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());

import authRoutes from "./routes/auth";
import inscriptionRoutes from "./routes/inscription";
import profilRoutes from "./routes/profil";
import questionnaireRoutes from "./routes/questionnaire";
import adminRoutes from "./routes/admin/index";

app.use("/auth", authRoutes);
app.use("/inscription", inscriptionRoutes);
app.use("/me", profilRoutes);
app.use("/me/questionnaire", questionnaireRoutes);
app.use("/admin", adminRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend démarré sur le port ${PORT}`));
