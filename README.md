# Sistema Server APIs

Bem-vindo ao ecossistema de APIs e microsserviços do projeto. Este documento fornece uma visão geral da arquitetura, das tecnologias utilizadas e da estrutura do projeto para ajudar desenvolvedores a se orientarem.

## Visão Geral da Arquitetura

Este repositório segue um padrão de **monorepo**, abrigando múltiplos microsserviços, cada um responsável por um domínio de negócio específico. A arquitetura é projetada para ser modular и escalável.

Os componentes principais são:

*   **Microsserviços:** Aplicações Node.js independentes que expõem APIs RESTful.
*   **Tarefas Agendadas (Cron):** Scripts localizados na pasta `/cron` que executam tarefas recorrentes, como rankings e processamento de pagamentos.
*   **Filas e Workers (Queues & Workers):** Utiliza um sistema de filas (provavelmente Bull/Redis, a julgar pela estrutura em `/queues` e `/workers`) para processar tarefas assíncronas e pesadas em segundo plano, como o envio de notificações push e campanhas.
*   **Modelos de Dados Compartilhados:** Os modelos de banco de dados (Sequelize) estão centralizados na pasta `/models`, permitindo consistência entre os serviços.

## Tecnologias Principais

*   **Node.js:** Ambiente de execução para JavaScript/TypeScript.
*   **Express.js:** Framework para a construção das APIs.
*   **Sequelize:** ORM (Object-Relational Mapper) para interação com o banco de dados.
*   **TypeScript:** Usado em serviços mais recentes para maior robustez e manutenibilidade.
*   **Redis/Bull (inferido):** Para gerenciamento de filas e tarefas em background.

## Estrutura do Projeto

```
/
├── cron/               # Scripts para tarefas agendadas (cron jobs).
├── micro_services/     # Contém todos os microsserviços.
├── models/             # Modelos de dados do Sequelize (schema do banco de dados).
├── queues/             # Definição das filas de tarefas (e.g., Bull).
├── workers/            # Processadores para as tarefas das filas.
├── package.json        # Dependências e scripts do projeto principal.
└── ...
```

---

## Microsserviços

Cada microsserviço é uma aplicação autônoma com suas próprias dependências e rotas. Para detalhes de implementação, endpoints e como executar cada um, **consulte o `README.md` dentro da respectiva pasta do serviço.**

### 1. `micro_service_apis`

*   **Descrição:** Serviço central que parece agregar diversas funcionalidades essenciais do sistema, incluindo gestão de produtores, comissões, bônus e rankings.
*   **Documentação:** [./micro_services/micro_service_apis/README.md](./micro_services/micro_service_apis/README.md)

### 2. `micro_service_apis_automation`

*   **Descrição:** Serviço em TypeScript dedicado à automação e execução de tarefas em segundo plano. Gerencia filas de jobs e processos assíncronos.
*   **Documentação:** [./micro_services/micro_service_apis_automation/README.md](./micro_services/micro_service_apis_automation/README.md)

### 3. `micro_service_apis_campaign`

*   **Descrição:** Gerencia a criação e o envio de campanhas (provavelmente e-mail ou push).
*   **Documentação:** [./micro_services/micro_service_apis_campaign/README.md](./micro_services/micro_service_apis_campaign/README.md)

### 4. `micro_service_apis_clientes`

*   **Descrição:** API focada nas funcionalidades do portal do cliente, como autenticação, gestão de dados de usuários e notificações.
*   **Documentação:** [./micro_services/micro_service_apis_clientes/README.md](./micro_services/micro_service_apis_clientes/README.md)

### 5. `micro_service_apis_digital_saude`

*   **Descrição:** API responsável pelas operações relacionadas ao produto "Digital Saúde".
*   **Documentação:** [./micro_services/micro_service_apis_digital_saude/README.md](./micro_services/micro_service_apis_digital_saude/README.md)

### 6. `micro_service_apis_swile`

*   **Descrição:** Serviço de integração com a plataforma de benefícios Swile, provavelmente para processar pagamentos e recompensas.
*   **Documentação:** [./micro_services/micro_service_apis_swile/README.md](./micro_services/micro_service_apis_swile/README.md)

---

## Como Começar (Getting Started)

1.  **Pré-requisitos:**
    *   Node.js (verifique a versão no `.nvmrc` ou `package.json`)
    *   Um servidor de banco de dados compatível com Sequelize (e.g., PostgreSQL, MySQL).
    *   Redis (para as filas e workers).

2.  **Instalação:**
    ```bash
    # Clone o repositório
    git clone <https://github.com/DevEasyPlan/Sistema_Server_APIS_Workspace>
    cd Sistema_Server_APIS_Workspace

    # Instale as dependências da raiz e dos microsserviços
    npm install
    # (Pode ser necessário um script para instalar as dependências de todos os serviços de uma vez)
    ```

3.  **Configuração:**
    *   Crie um arquivo `.env` na raiz do projeto ou em cada microsserviço, baseado nos arquivos de exemplo (`.env.example`, se existirem).
    *   Configure as variáveis de ambiente, principalmente as de conexão com o banco de dados e Redis.

4.  **Executando os serviços:**
    *   Consulte o `package.json` na raiz e em cada microsserviço para ver os scripts disponíveis (e.g., `npm start`, `npm run dev`).
