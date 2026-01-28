# Microsserviço de Clientes

Este microsserviço é uma aplicação Node.js, construída com o framework Express.js, e é dedicado ao gerenciamento de dados e funcionalidades relacionadas aos clientes.

## Tecnologias Principais

*   **Node.js:** Ambiente de execução JavaScript no servidor.
*   **Express.js:** Framework para construção de aplicações web e APIs.
*   **Sequelize:** ORM (Object-Relational Mapper) baseado em promises para interagir com o banco de dados.
*   **morgan-body:** Middleware para registrar detalhes das requisições e respostas HTTP.
*   **body-parser:** Middleware para fazer o parse do corpo das requisições.
*   **cors:** Middleware para habilitar o CORS (Cross-Origin Resource Sharing).
*   **dotenv:** Módulo para carregar variáveis de ambiente a partir de um arquivo `.env`.

## Funcionalidades

Este microsserviço lida com as funcionalidades centrais relacionadas aos usuários finais (clientes) da aplicação. Suas responsabilidades incluem:

*   **Gerenciamento de Clientes:** Gerencia o cadastro, os dados de perfil e a autenticação dos clientes.
*   **Autenticação:** Fornece endpoints para login, logout e autenticação de dois fatores.
*   **Gerenciamento de Beneficiários:** Lida com os dados dos beneficiários associados aos clientes.
*   **Redes Credenciadas:** Fornece informações sobre as redes credenciadas.
*   **Gerenciamento de Contatos:** Gerencia as informações de contato dos clientes.
*   **Notificações Push:** Gerencia os dispositivos registrados para receber notificações push e provavelmente lida com o envio de notificações (por exemplo, relacionadas a boletos de pagamento).

## Configuração e Execução

1.  **Instalar dependências:**
    ```bash
    npm install
    ```
2.  **Criar arquivo `.env`:**
    Crie um arquivo `.env` na raiz deste microsserviço e adicione as variáveis de ambiente necessárias para a conexão com o banco de dados, porta do servidor (o padrão é 3092), etc.
3.  **Executar o serviço:**
    ```bash
    npm start
    ```
