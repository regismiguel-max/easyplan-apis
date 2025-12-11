const allowedOrigins = [
    'http://localhost',
    'https://localhost',
    'http://localhost:8080',
    'http://localhost:8100',
    'http://localhost:8101',
    'http://localhost:8102',
    'http://corretor.easyplan.com.br',
    'https://corretor.easyplan.com.br',
    'http://app.easyplan.com.br',
    'https://app.easyplan.com.br',
    'http://clientes.easyplan.com.br',
    'https://clientes.easyplan.com.br',
    'http://admin.easyplan.com.br',
    'https://admin.easyplan.com.br',
    'http://supervisor.easyplan.com.br',
    'https://supervisor.easyplan.com.br',
    'ionic://*',
    'ionic://corretor.easyplan.com.br',
    'ionic://app.easyplan.com.br',
    'http://10.61.1.191:8100',
    'http://10.61.1.211:8100',
    'https://easyplan.com.br',
    'https://www.easyplan.com.br',
];

const corsOptions = {
    origin: (origin, callback) => {
        console.log("CORS Origin solicitado:", origin);
    
        // Permite Postman, Insomnia, chamadas internas
        if (!origin) {
            return callback(null, true);
        }
    
        // Normaliza remoção de barra final
        const cleanOrigin = origin.replace(/\/$/, "");
    
        // Se está na lista
        if (allowedOrigins.includes(cleanOrigin)) {
            return callback(null, true);
        }
    
        // Permite qualquer subdomínio do lovable
        if (cleanOrigin.endsWith('.lovable.app') || cleanOrigin.endsWith('.lovableproject.com')) {
            return callback(null, true);
        }
    
        return callback(new Error('Origin not allowed by CORS: ' + origin));
    },
    credentials: true
};

module.exports = corsOptions;
