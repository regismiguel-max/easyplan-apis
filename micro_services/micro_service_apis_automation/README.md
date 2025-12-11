# Microsserviço de Automação de APIs

Este microsserviço é responsável por gerenciar e executar tarefas em segundo plano (background jobs), tarefas agendadas e outras automações. Ele é construído com TypeScript e segue uma arquitetura robusta baseada em workers para lidar com tarefas assíncronas de forma eficiente.

## Tecnologias Principais

*   **Node.js & TypeScript:** Para o ambiente de execução e a linguagem da aplicação.
*   **Express.js:** Utilizado para fornecer um painel de monitoramento para as filas de tarefas.
*   **BullMQ:** Um sistema de filas de tarefas poderoso e baseado em Redis para Node.js.
*   **IORedis:** Um cliente Redis de alta performance utilizado pelo BullMQ.
*   **Node-Cron:** Um agendador de tarefas do tipo cron para executar rotinas em intervalos especificados.
*   **Sequelize:** ORM para interação com o banco de dados.
*   **Nodemailer:** Usado para enviar e-mails como parte de uma tarefa automatizada.
*   **Axios:** Usado para fazer requisições HTTP para outros serviços ou APIs externas.

## Arquitetura

O serviço é dividido em dois processos principais:

1.  **Servidor da API (`server.ts`):** Um servidor Express que serve principalmente a interface do usuário do `@bull-board/express`. Este painel permite que desenvolvedores e administradores monitorem o status em tempo real das filas e das tarefas (pendentes, ativas, concluídas, falhas).
2.  **Worker (`worker.ts`):** Esta é a unidade de processamento principal. É um processo Node.js dedicado que escuta por novas tarefas nas filas do BullMQ e as executa. A lógica para as tarefas é definida no diretório `src/processors`.

Essa separação garante que tarefas de longa duração em segundo plano não bloqueiem o loop de eventos principal ou afetem o desempenho de outras operações.

## Componentes Principais

*   **`src/jobs`:** Contém as definições para os diferentes tipos de tarefas que podem ser enfileiradas.
*   **`src/queues`:** Configura as diferentes filas do BullMQ usadas pela aplicação.
*   **`src/processors`:** Implementa a lógica de negócio real para cada tarefa. Cada processador está associado a uma fila e tipo de tarefa específicos.
*   **`src/cron`:** Contém as definições de tarefas cron que agendam rotinas recorrentes, como adicionar tarefas à fila em intervalos regulares.
*   **`scripts/`:** Contém scripts utilitários para interagir com o serviço a partir da linha de comando, como listar ou limpar tarefas.

## Configuração e Execução

1.  **Instalar dependências:**
    ```bash
    npm install
    ```
2.  **Criar arquivo `.env`:**
    Crie um arquivo `.env` e adicione as variáveis de ambiente necessárias, especialmente para as conexões com o Redis e o banco de dados.
3.  **Compilar o código TypeScript:**
    ```bash
    npm run build
    ```
4.  **Executar o servidor e o worker:**
    É recomendado executar tanto o servidor quanto o worker para que o sistema esteja totalmente operacional.
    ```bash
    # Executar o servidor da API (para o painel)
    npm run start

    # Executar o worker de segundo plano
    npm run worker
    ```
    Alternativamente, você pode executar ambos concorrentemente em modo de desenvolvimento:
    ```bash
    npm run dev
    ```
