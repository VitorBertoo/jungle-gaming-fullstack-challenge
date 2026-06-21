# Crash Game — Jungle Gaming Full-Stack Challenge

Um jogo crash multiplayer em tempo real construído com NestJS, Bun, React e Socket.io. Jogadores apostam antes de cada rodada, assistem o multiplicador subir e sacam antes do crash.

---

## Início Rápido

**Requisitos:** Bun ≥ 1.x · Docker & Docker Compose

```bash
bun install
bun run docker:up      # builda as imagens, roda as migrations, sobe tudo
```

A stack é totalmente automatizada — realm do Keycloak, rotas do Kong e schemas do banco de dados são configurados na primeira inicialização. Nenhum passo manual necessário.

| URL | Serviço |
|-----|---------|
| `http://localhost:3000` | Frontend |
| `http://localhost:8000` | Kong API Gateway |
| `http://localhost:8080` | Keycloak |
| `http://localhost:15672` | RabbitMQ Management UI |
| `http://localhost:4001/api` | Games Service — Swagger |
| `http://localhost:4002/api` | Wallets Service — Swagger |

**Conta de teste:** `player` / `player123`
**Chave de admin:** `admin-secret` (header: `x-admin-key`)

---

## Arquitetura

```
┌─────────────────────────────────┐
│          Frontend               │
│  React · Vite · Zustand         │
│  oidc-client-ts · Socket.io     │
└────────────┬──────────┬─────────┘
           REST       WebSocket
             │            │
     ┌───────▼────────────▼────────┐
     │         Kong 3.9            │
     │  /games/*  →  games:4001    │
     │  /wallets/* → wallets:4002  │
     │  CORS · Rate limiting       │
     └───────┬────────────┬────────┘
             │            │
   ┌─────────▼──┐   ┌─────▼──────────┐
   │  Games     │   │  Wallets       │
   │  Service   │   │  Service       │
   │  NestJS    │   │  NestJS        │
   │  Port 4001 │   │  Port 4002     │
   └──┬──────┬──┘   └──────┬─────────┘
      │      └──────┬───────┘
  ┌───▼───┐   ┌─────▼─────────┐
  │Postgres│   │   RabbitMQ    │
  │ games  │   │ wallet_events │
  │wallets │   │ game_events   │
  └────────┘   └───────────────┘

         ┌──────────────┐
         │   Keycloak   │
         │ realm: crash-game
         └──────────────┘
```

### Saga Assíncrona de Apostas (RabbitMQ)

As apostas são aceitas imediatamente (HTTP 201) e liquidadas de forma assíncrona:

```
Jogador → POST /games/bet → Games Service
  └─ salva aposta como PENDING_DEBIT
  └─ publica wallet.debit.request
       └─ Wallets Service deduz o saldo
            ├─ sucesso → publica wallet.debit.confirmed
            │    └─ Games Service marca aposta como ACTIVE
            └─ falha (saldo insuficiente) → publica wallet.debit.failed
                 └─ Games Service marca aposta como CANCELLED
                 └─ emite evento WebSocket bet:cancelled para o jogador

No cashout:
Jogador → POST /games/bet/cashout → Games Service (síncrono)
  └─ marca aposta como CASHED_OUT, calcula pagamento
  └─ publica wallet.credit.request
       └─ Wallets Service credita o saldo
```

---

## Tech Stack

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Bun |
| Backend | NestJS · TypeScript strict |
| Banco de Dados | PostgreSQL 18 · Prisma ORM |
| Mensageria | RabbitMQ 4 |
| API Gateway | Kong 3.9 |
| Autenticação | Keycloak 26 (OIDC / PKCE S256) |
| WebSocket | Socket.io via `@nestjs/websockets` |
| Frontend | React 19 · Vite · Tailwind CSS v4 · shadcn/ui |
| Estado | Zustand (client) |
| Testes | Bun test runner |
| Documentação | Swagger / OpenAPI |
| Infra | Docker Compose |

---

## Estrutura do Projeto

```
├── services/
│   ├── games/            # Ciclo de vida da rodada, apostas, provably fair, WebSocket
│   │   ├── src/
│   │   │   ├── domain/           # Entidades Round, Bet + erros
│   │   │   ├── application/      # Use cases + RoundLifecycleService
│   │   │   ├── infrastructure/   # Prisma, gateway Socket.io, RabbitMQ
│   │   │   └── presentation/     # Controllers HTTP + DTOs
│   │   └── tests/
│   │       ├── unit/             # Testes de lógica de domínio
│   │       └── e2e/              # Testes de integração de API
│   └── wallets/          # Carteiras dos jogadores, saldo, crédito/débito
│       ├── src/
│       │   ├── domain/           # Entidade Wallet
│       │   ├── application/      # Use cases
│       │   ├── infrastructure/   # Prisma, consumer RabbitMQ, admin Keycloak
│       │   └── presentation/     # Controllers HTTP (jogador + admin)
│       └── tests/unit/
├── frontend/
│   ├── src/
│   │   ├── components/   # CrashChart, BetControls, LiveBetsList, RoundHistory…
│   │   ├── hooks/        # useSocket, useAuthInit
│   │   ├── pages/        # Game, Admin, Login
│   │   └── stores/       # game.store.ts, auth.store.ts (Zustand)
│   └── tests/
├── docker/
│   ├── kong/kong.yml     # Rotas, CORS, rate limiting
│   ├── keycloak/         # Export do realm (importado automaticamente no docker:up)
│   └── postgres/         # Script de inicialização dos bancos (games + wallets)
├── packages/             # Pacotes compartilhados (config do eslint)
└── docker-compose.yml
```

---

## Referência da API

Todos os endpoints são acessados via Kong (`http://localhost:8000`).

### Games Service — `/games`

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| `GET` | `/games/health` | — | Health check |
| `GET` | `/games/rounds/current` | — | Estado da rodada ativa (crash point oculto até o crash) |
| `GET` | `/games/rounds/history` | — | Histórico paginado de rodadas encerradas |
| `GET` | `/games/rounds/:id/verify` | — | Dados de verificação provably fair |
| `GET` | `/games/bets/me` | Bearer | Histórico paginado de apostas do jogador |
| `POST` | `/games/bet` | Bearer | Fazer aposta (100–100 000 centavos, apenas na fase BETTING) |
| `POST` | `/games/bet/cashout` | Bearer | Sacar no multiplicador atual (apenas na fase RUNNING) |

### Wallets Service — `/wallets`

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| `GET` | `/wallets/health` | — | Health check |
| `POST` | `/wallets` | Bearer | Criar carteira para o jogador autenticado |
| `GET` | `/wallets/me` | Bearer | Carteira e saldo do jogador atual |
| `GET` | `/wallets/admin/users` | x-admin-key | Listar usuários do Keycloak |
| `POST` | `/wallets/admin/users` | x-admin-key | Criar usuário + carteira |
| `DELETE` | `/wallets/admin/users/:id` | x-admin-key | Deletar usuário do Keycloak |
| `GET` | `/wallets/admin/wallets` | x-admin-key | Listar todas as carteiras |
| `POST` | `/wallets/admin/wallets/:playerId/topup` | x-admin-key | Recarregar qualquer carteira |

### Eventos WebSocket (servidor → cliente)

Conectar em `http://localhost:8000` com `path: /games/socket.io`.

| Evento | Payload | Descrição |
|--------|---------|-----------|
| `round:betting` | `{ id, status, serverSeedHash, bettingEndsAt, bets[] }` | Nova fase de apostas iniciada |
| `round:started` | `{ id, status, startedAt }` | Multiplicador em alta |
| `multiplier:tick` | `{ roundId, multiplier }` | Multiplicador atual (centésimos inteiros) |
| `bet:placed` | `{ roundId, betId, playerId, username, amountInCents }` | Outro jogador apostou |
| `bet:cashout` | `{ roundId, betId, playerId, cashOutMultiplier, payoutInCents }` | Jogador sacou |
| `round:crashed` | `{ id, crashPointMultiplier, serverSeed, serverSeedHash, nonce }` | Rodada encerrada |
| `bet:cancelled` | `{ betId, reason }` | Débito assíncrono falhou (enviado apenas ao jogador afetado) |

---

## Provably Fair

O crash point de cada rodada é pré-determinado antes da fase de apostas, usando um algoritmo HMAC-SHA256:

```
serverSeed      = randomBytes(32).hex()         // gerado antes da rodada
serverSeedHash  = SHA256(serverSeed)            // exibido aos jogadores antes das apostas
nonce           = contador incremental de rodadas

h = HMAC-SHA256(key=serverSeed, data=nonce.toString()).hex()
e = parseInt(h[0..7], 16)                       // primeiros 4 bytes como uint32

se (e % 33 === 0):  crashPoint = 1.00x          // ~3% de vantagem da casa
senão:              crashPoint = max(1.00, floor(99 / (1 - e / 0xFFFFFFFF) + 100) / 100)
```

Após o crash, o `serverSeed` é revelado. Os jogadores podem verificar independentemente:
1. `SHA256(serverSeed) === serverSeedHash` — a seed não foi alterada após a abertura das apostas
2. Recalcular o crash point usando a fórmula — o resultado deve coincidir com o do servidor

Endpoint de verificação: `GET /games/rounds/:id/verify`

---

## Executando os Testes

```bash
# Testes unitários
cd services/games   && bun test tests/unit
cd services/wallets && bun test tests/unit
cd frontend         && bun test

# Testes E2E (requer docker:up)
cd services/games && bun test tests/e2e
```

---

## Decisões de Arquitetura e Trade-offs

### Precisão monetária — BigInt
Todos os valores monetários são armazenados e calculados como centavos inteiros (`BIGINT` no Postgres, `bigint` no TypeScript). Nenhum ponto flutuante é usado em nenhum ponto do fluxo financeiro. Isso elimina erros de arredondamento ao custo de uma aritmética ligeiramente mais verbosa.

### Débito assíncrono de apostas (padrão saga)
As apostas são aceitas imediatamente com status `PENDING_DEBIT` e liquidadas via RabbitMQ. Isso mantém o endpoint de apostas rápido e desacopla o serviço de carteiras. O trade-off é consistência eventual: um jogador pode "fazer" uma aposta que será cancelada caso sua carteira não tenha saldo suficiente. O frontend escuta o evento WebSocket `bet:cancelled` e exibe um toast.

### Separação do issuer JWT (`KEYCLOAK_ISSUER` vs `KEYCLOAK_INTERNAL_URL`)
Os tokens do Keycloak carregam `iss: http://localhost:8080/...` (a URL pública). Para validação de JWT, os serviços precisam usar a mesma URL. Para chamadas à API admin de dentro do Docker, o hostname interno `keycloak:8080` é usado. Esses valores são configurados como variáveis de ambiente separadas para evitar quebrar a validação de JWT ao alternar para rede interna.

### Kong `strip_path: true`
O Kong remove o prefixo da rota (`/games`, `/wallets`) antes de encaminhar. Os controllers do NestJS usam rotas sem o prefixo. Clientes WebSocket conectam com `path: /games/socket.io` para que o Kong faça o roteamento corretamente.

### Proxy de admin do Keycloak no Wallets Service
O gerenciamento de usuários (criar/deletar) é feito via proxy pelo controller admin do Wallets Service, em vez de expor o Keycloak diretamente ao frontend. Isso permite que o serviço crie atomicamente um usuário no Keycloak + carteira em uma única chamada de API, e mantém a `x-admin-key` como única credencial externa necessária.

### Gráfico do multiplicador em Canvas
A curva de crash é renderizada em um Canvas HTML5 via loop `requestAnimationFrame` usando `useGameStore.subscribe()`. Isso evita re-renders do React a cada tick do multiplicador (~10 Hz), mantendo o restante da UI reativo.

---

## Funcionalidades Bônus Implementadas

- **Rate limiting** — Plugin do Kong: 120 req/min por IP
- **Painel de admin** — Criar/deletar usuários, recarregar carteiras, listar todas as carteiras
- **Modal de detalhes da rodada** — Clique em qualquer chip do histórico para ver o hash da seed, a server seed (pós-crash), o nonce e a fórmula provably fair
- **Copiar para área de transferência** nos valores de seed
- **`bun run env:init`** — Copia `.env.example` → `.env` automaticamente no `docker:up`
- **Toast de falha no débito** — O frontend exibe o motivo quando uma aposta é cancelada por saldo insuficiente
- **Auto Bet** — Ativa apostas automáticas no início de cada rodada usando o valor configurado no input
- **Auto Cashout** — Saca automaticamente quando o multiplicador atinge o alvo configurado (ex.: 2.00×); dispara no máximo uma vez por rodada
