import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";

dotenv.config(); // Carrega variáveis do .env

const app = express();

// Middlewares globais
app.use(helmet());               // Segurança
app.use(cors());                 // Liberação de origens

// ⚠️ Ajuste do limite de payload aqui
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Rotas da aplicação
import routes from "./routes";
app.use("/api/v1", routes);
app.get("/api/v1", (req, res) => {
    res.json({ message: "Welcome to base EasyPlan application." });
});

export default app;
