const allowedOrigins = [
  'http://localhost',
  'https://localhost',
  'http://localhost:8080',
  'http://localhost:8100',
  'http://localhost:8101',
  'http://localhost:8102',
  'http://admin.easyplan.com.br',
  'https://admin.easyplan.com.br',
  'ionic://*',
  'http://10.61.1.191:8100',
];

const corsOptions = {
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin) || !origin) {
      return callback(null, true);
      // add return pra evitar loop
    }

    const cleanOrigin = origin.replace(/\/$/, "");
    
    if (cleanOrigin.endsWith('.lovable.app') || cleanOrigin.endsWith('.lovableproject.com')) {
      return callback(null, true);
    }
    
    
    return callback(new Error('Origin not allowed by CORS'));
    
  }
};

module.exports = corsOptions;