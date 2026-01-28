import express from 'express'
import swaggerUi from 'swagger-ui-express'


const app = express();

const swaggerDocument = {
    openapi: '3.0.0',
    info : {
        title: 'Easy Plan API DOCS',
        version: '1.0.0',
        description: 'Selecione uma API'
    }
};

const swaggerOptions = {
    explorer: true,
    
    swaggerOptions: {
        version: 1.0,
        urls: [
            {
                url: 'https://localhost:3088',
                name: 'APIS'
            },
            {
                url: 'https://localhost:3096',
                name: 'Automation'
            },
            {
                url: 'https://localhost:3094',
                name: 'Campaign'
            },
            {
                url: 'https://localhost:3092',
                name: 'Clientes'
            },
            {
                url: 'https://localhost:3090',
                name: 'Digital Saúde'
            },
            {
                url: 'https://localhost:3086',
                name: 'Swile'
            }
        ]
    }
};

app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));

const port = 3000;

app.listen(port, () => {
    console.log(`Server is listening in http://localhost:${port}`)
});

