# Microsserviço Digital Saúde

Este microsserviço é uma aplicação Node.js, construída com o framework Express.js, e é responsável por lidar com as funcionalidades relacionadas ao domínio "Digital Saúde".

## Tecnologias Principais

*   **Node.js:** Ambiente de execução JavaScript no servidor.
*   **Express.js:** Framework para construção de aplicações web e APIs.
*   **Sequelize:** ORM (Object-Relational Mapper) baseado em promises para interagir com o banco de dados.
*   **morgan-body:** Middleware para registrar detalhes das requisições e respostas HTTP.
*   **body-parser:** Middleware para fazer o parse do corpo das requisições.
*   **cors:** Middleware para habilitar o CORS (Cross-Origin Resource Sharing).
*   **dotenv:** Módulo para carregar variáveis de ambiente a partir de um arquivo `.env`.

## Funcionalidades

Este serviço gerencia as operações principais para o produto Digital Saúde, incluindo:

*   **Gerenciamento de Contratos:** Lida com a criação e o gerenciamento de contratos dos clientes.
*   **Faturamento e Cobrança:** Gerencia faturas, lançamentos financeiros e demonstrativos.
*   **Gerenciamento de Beneficiários:** Gerencia os beneficiários associados aos planos de saúde.
*   **Integração com Suporte:** Integra-se com o Zendesk para a abertura e o gerenciamento de tickets de suporte ao cliente.
*   **Controle de Acesso:** Gerencia tokens de acesso para autenticação e autorização na API.

## Configuração e Execução

1.  **Instalar dependências:**
    ```bash
    npm install
    ```
2.  **Criar arquivo `.env`:**
    Crie um arquivo `.env` na raiz deste microsserviço e adicione as variáveis de ambiente necessárias, como a conexão com o banco de dados e a porta do servidor (o padrão é 3090).
3.  **Executar o serviço:**
    ```bash
    npm start
    ```
