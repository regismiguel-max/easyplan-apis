import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.config";

export const cpfContratoQueue = new Queue("cpf-contrato", {
    connection: redisConnection,
});
