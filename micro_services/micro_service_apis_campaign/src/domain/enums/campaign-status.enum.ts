export enum CampaignStatus {
    DRAFT = "DRAFT",                 // Rascunho — não disparado
    PENDING = "PENDING",             // Agendado para disparo
    QUEUED = "QUEUED",               // Na fila de envio
    PROCESSING = "PROCESSING",       // Job em execução
    PARTIALLY_SENT = "PARTIALLY_SENT", // Parte enviada, parte falhou
    SENT = "SENT",                   // Tudo enviado com sucesso
    FAILED = "FAILED",               // Tudo falhou
    CANCELLED = "CANCELLED",         // Cancelado manualmente
}