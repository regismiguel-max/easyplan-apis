import { CorsOptions } from 'cors';

const allowedOrigins = [
    'http://localhost',
    'https://localhost',
    'http://localhost:8080',
    'http://localhost:8100',
    'http://localhost:8100/',
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
];

const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Origin not allowed by CORS'));
        }
    }
};

export default corsOptions;