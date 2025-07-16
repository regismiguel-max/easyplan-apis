import path from "path";
import dotenv from "dotenv";
import axios, { AxiosInstance } from "axios";
import http from "http";
import https from "https";
import logger from "../config/logger.config";

// Carrega variáveis do .env
// dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

const commonAgentConfig = {
    keepAlive: true,
    keepAliveMsecs: 0,
    timeout: 120000,
    scheduling: "fifo" as const
};

const axiosPlanium: AxiosInstance = axios.create({
    baseURL: process.env.AUTOMATION_PLANIUM_BASEURL,
    headers: {
        "Planium-apikey": process.env.AUTOMATION_PLANIUM_APIKEY || "",
    },
    httpAgent: new http.Agent(commonAgentConfig),
    httpsAgent: new https.Agent(commonAgentConfig),
});

const axiosDigital: AxiosInstance = axios.create({
    baseURL: process.env.AUTOMATION_DIGITAL_BASEURL,
    timeout: 15000,
    headers: {
        token: process.env.AUTOMATION_DIGITAL_TOKEN,
        senhaApi: process.env.AUTOMATION_DIGITAL_SENHAAPI,
    },
    httpAgent: new http.Agent(commonAgentConfig),
    httpsAgent: new https.Agent(commonAgentConfig),
});

axiosDigital.interceptors.response.use(
    res => res,
    error => {
        logger.error("❌ Erro Axios Digital:", error.message);
        return Promise.reject(error);
    }
);

const axiosWhatsapp: AxiosInstance = axios.create({
    baseURL: process.env.AUTOMATION_WHATSAPP_API_URL,
    headers: {
        "Content-Type": "application/json",
    },
    httpAgent: new http.Agent(commonAgentConfig),
    httpsAgent: new https.Agent(commonAgentConfig),
});

export default {
    axiosPlanium,
    axiosDigital,
    axiosWhatsapp,
};