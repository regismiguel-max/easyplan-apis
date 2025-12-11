# Microsserviço de Campanhas

Este microsserviço, construído com Node.js e TypeScript, é projetado para gerenciar e enviar campanhas de e-mail.

## Arquitetura

O serviço é estruturado seguindo os princípios da **Arquitetura Hexagonal (Portas e Adaptadores)**, que separa a lógica de negócio principal das preocupações externas. Isso resulta em uma aplicação mais manutenível, escalável e testável.

*   **`domain`:** Contém a lógica de negócio principal, entidades e objetos de valor relacionados a campanhas. É o coração da aplicação e não possui dependências externas.
*   **`application`:** Implementa os casos de uso da aplicação, orquestrando a camada de domínio.
*   **`infrastructure`:** Fornece as implementações concretas para serviços externos (adaptadores), tais como:
    *   Acesso ao banco de dados usando Sequelize.
    *   Fila de tarefas com BullMQ e Redis.
    *   Envio de e-mails via SendGrid.
*   **`presentation`:** Expõe as funcionalidades da aplicação para o mundo exterior através de uma API REST construída com Express.js.

## Tecnologias Principais

*   **Node.js & TypeScript:** Para o ambiente de execução e a linguagem da aplicação.
*   **Express.js:** Para construir a API REST (camada `presentation`).
*   **SendGrid:** Para o envio de campanhas de e-mail.
*   **BullMQ & IORedis:** Para gerenciar e processar tarefas assíncronas de envio de grandes volumes de e-mails.
*   **Sequelize:** Como o ORM para interação com o banco de dados (camada `infrastructure`).
*   **Multer & Sharp:** Para manipulação de uploads e processamento de imagens.
*   **Node-Cron:** Para o agendamento de campanhas e outras tarefas.
*   **html-to-text:** Para converter o conteúdo de e-mail HTML em uma versão de texto simples.

## Funcionalidades

*   **Gerenciamento de Campanhas:** Criar, ler, atualizar e deletar campanhas de e-mail.
*   **Envio de E-mails:** Envia campanhas de e-mail para uma lista de destinatários, seja imediatamente ou de forma agendada.
*   **Gerenciamento de Templates:** Gerencia templates de e-mail em HTML (armazenados no diretório `templateHTML`).
*   **Envio Assíncrono:** Utiliza uma fila de tarefas para enviar e-mails em segundo plano, garantindo que a API permaneça responsiva e possa lidar com grandes campanhas.
*   **Manipulação de Imagens:** Permite o upload e processamento de imagens para serem usadas nas campanhas.
*   **Campanhas Agendadas:** Agenda campanhas para serem enviadas em uma data e hora específicas.

## Configuração e Execução

1.  **Instalar dependências:**
    ```bash
    npm install
    ```
2.  **Criar arquivo `.env`:**
    Crie um arquivo `.env` e adicione as variáveis de ambiente necessárias (conexões de banco de dados, Redis, chaves da API SendGrid, etc.).
3.  **Compilar o código:**
    ```bash
    npm run build
    ```
4.  **Executar o serviço:**
    ```bash
    # Para desenvolvimento
    npm run dev

    # Para produção (servidor + worker)
    npm start
    npm run worker
    ```
