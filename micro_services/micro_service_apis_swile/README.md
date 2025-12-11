# Microsserviço de Integração Swile

Este microsserviço é uma aplicação Node.js, construída com o framework Express.js, e serve como um ponto de integração dedicado com a plataforma de benefícios e recompensas Swile.

## Tecnologias Principais

*   **Node.js:** Ambiente de execução JavaScript no servidor.
*   **Express.js:** Framework para construção de aplicações web e APIs.
*   **Sequelize:** ORM (Object-Relational Mapper) baseado em promises para interagir com o banco de dados.
*   **morgan-body:** Middleware para registrar detalhes das requisições e respostas HTTP.
*   **body-parser:** Middleware para fazer o parse do corpo das requisições.
*   **cors:** Middleware para habilitar o CORS (Cross-Origin Resource Sharing).
*   **dotenv:** Módulo para carregar variáveis de ambiente a partir de um arquivo `.env`.

## Funcionalidades

O objetivo principal deste microsserviço é lidar com o pagamento de bônus e outras recompensas através da plataforma Swile.

*   **Integração Swile:** Gerencia a conexão e a autenticação com a API da Swile.
*   **Processamento de Pagamento de Bônus:** Contém a lógica para processar lotes de bônus (`lote de bônus`) que estão prontos para serem pagos.
*   **Tarefas Agendadas:** Inclui tarefas cron (sugerido pelo script `testarCronSwile.js`) para automatizar o processo de envio de informações de pagamento para a Swile.
*   **Autenticação:** Gerencia a autenticação de usuários e a autenticação de dois fatores para acessar suas funcionalidades.

## Configuração e Execução

1.  **Instalar dependências:**
    ```bash
    npm install
    ```
2.  **Criar arquivo `.env`:**
    Crie um arquivo `.env` na raiz deste microsserviço e adicione as variáveis de ambiente necessárias, como a conexão com o banco de dados, chaves da API Swile e a porta do servidor (o padrão é 3086).
3.  **Executar o serviço:**
    ```bash
    npm start
    ```
