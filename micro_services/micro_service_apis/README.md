# Microsserviço de APIs

Este microsserviço é a principal API de backend do sistema, funcionando como um "Backend for Frontend" (BFF) e lidando com uma vasta gama de funcionalidades. Ele segue uma arquitetura onde as funcionalidades são organizadas por domínio.

## Tecnologias Principais

*   **Node.js:** Ambiente de execução JavaScript no servidor.
*   **Express.js:** Framework para construção de aplicações web e APIs.
*   **Sequelize:** ORM (Object-Relational Mapper) baseado em promises para interagir com o banco de dados.
*   **morgan-body:** Middleware para registrar detalhes das requisições e respostas HTTP.
*   **dotenv:** Módulo para carregar variáveis de ambiente a partir de um arquivo `.env`.

## Principais Funcionalidades e Endpoints

Este serviço expõe um grande número de endpoints, que podem ser agrupados nos seguintes domínios:

### Autenticação & Usuários
*   `/api/auth/`: Gerencia a autenticação de usuários e supervisores.
*   `/api/users/`: Gerencia os dados dos usuários.
*   `/api/corretoras/auth/`: Gerencia a autenticação de corretoras.
*   `/api/produtores/auth/`: Gerencia a autenticação de produtores.
*   `/api/twoFactorAuthentication/`: Endpoints para autenticação de dois fatores.

### Corretoras
*   `/api/corretoras/`: Endpoints centrais para o gerenciamento de corretoras.
*   `/api/corretoras-commissions/`: Gerencia as comissões das corretoras, incluindo lotes (`lote`), documentos fiscais (`NFDocumento`) e status.

### Produtores
*   `/api/produtores/`: Gerencia os dados dos produtores, seus documentos e vendas.

### Vendas & Suporte
*   `/api/apoio_vendas/`: Gerencia arquivos e documentos de suporte a vendas.
*   `/api/vendas/`: Endpoints para dados de vendas.
*   `/api/propostas/`: Gerencia propostas de vendas.

### Bônus, Carteiras & Ranking
*   `/api/bonuses/`: Gerencia bônus.
*   `/api/wallets/`: Gerencia carteiras digitais para produtores e corretoras.
*   `/api/ranking/`: Endpoints para rankings de vendas e produtos mais vendidos.
*   `/api/duelos/`: Funcionalidade de gamificação para competições de vendas.

### Vídeo & Conteúdo
*   `/api/streams/`: Gerencia a transmissão de vídeos.
*   `/api/ckeditor/`: Endpoints relacionados ao editor de texto rico CKEditor.
*   `/uploads`: Serve arquivos estáticos que foram carregados.

### Utilitários
*   `/api/utils/`: Uma vasta gama de endpoints utilitários, incluindo:
    *   Geolocalização (estados, cidades).
    *   Informações bancárias.
    *   Encurtador de URL.
    *   Versionamento da aplicação.
    *   Regras de negócio para bônus e períodos de fechamento.

## Configuração e Execução

1.  **Instalar dependências:**
    ```bash
    npm install
    ```
2.  **Criar arquivo `.env`:**
    Crie um arquivo `.env` na raiz deste microsserviço e adicione as variáveis de ambiente necessárias para a conexão com o banco de dados, porta do servidor, etc.
3.  **Executar o serviço:**
    ```bash
    npm start
    ```
O servidor será iniciado na porta definida no seu arquivo `.env` (o padrão é 3088).