# mediasswint

Software Interno Medias Elasticas — monorepo.

Stack de Etapa 1: Next.js 16.2.4 · Node 24.15.0 LTS · React 19.2 · PostgreSQL 18 · Redis 8.6 · Docker (Debian 13).

---

## Estructura

```
mediasswint/
├── apps/
│   └── web/                      # Next.js 16.2.4 (App Router, TS)
├── packages/                     # workspaces compartidos (vacío por ahora)
├── docker/
│   └── docker-compose.dev.yml    # Postgres 18 + Redis 8.6 (dev)
├── .env.example                  # plantilla de variables
├── .nvmrc                        # Node 24.15.0
├── pnpm-workspace.yaml
└── package.json                  # raíz (scripts del monorepo)
```

---

## Quickstart

### 1. Requisitos

- Node **24.15.0** (usar `nvm use` o `fnm use` con el `.nvmrc` del repo)
- pnpm **>=10**
- Docker y Docker Compose v2

### 2. Clonar e instalar

```bash
git clone https://github.com/sebasttiant/mediasswint.git
cd mediasswint
cp .env.example apps/web/.env
pnpm install
```

> Nota: Next.js carga `.env` desde el directorio de la app, por eso la copia va a `apps/web/.env`. El `.env.example` de la raíz es la referencia única de variables del proyecto.

### 3. Levantar infraestructura local (Postgres + Redis)

```bash
pnpm infra:up
```

Verificar que los contenedores estén sanos:

```bash
pnpm infra:ps
```

Deberías ver `mediasswint-postgres` y `mediasswint-redis` en estado `healthy`.

### 4. Levantar la app Next.js

```bash
pnpm dev
```

App disponible en: http://localhost:3000

### 5. Validar healthcheck

```bash
curl -s http://localhost:3000/api/health | jq
```

Respuesta esperada (HTTP 200):

```json
{
  "app": { "ok": true },
  "services": {
    "postgres": { "ok": true, "latency_ms": 12 },
    "redis":    { "ok": true, "latency_ms": 4 }
  }
}
```

Si Postgres o Redis no están arriba, la respuesta es HTTP 503 con el detalle del servicio que falló.

---

## Scripts útiles

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Levanta la app web en modo dev |
| `pnpm build` | Build de producción |
| `pnpm start` | Arranca el build de producción |
| `pnpm lint` | ESLint sobre la app web |
| `pnpm infra:up` | Levanta Postgres 18 + Redis 8.6 |
| `pnpm infra:down` | Detiene la infra |
| `pnpm infra:logs` | Logs en vivo de la infra |
| `pnpm infra:ps` | Estado de los contenedores |

---

## Variables de entorno

Ver `.env.example`. Para dev local alcanza con copiarlo a `.env`:

```bash
cp .env.example .env
```

**Importante**: `.env` está en `.gitignore`. Nunca commitear credenciales reales.

---

## Estado actual

Etapa 1 — bootstrap. Todavía no hay schema de dominio, ETL ni features.
El healthcheck solo valida conectividad con Postgres y Redis, sin lógica de negocio.
