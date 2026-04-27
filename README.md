# mediasswint

Software Interno Medias Elasticas — monorepo production-ready, **Docker-first**.

Stack Etapa 1: Next.js 16.2.4 · Node 24.15.0 LTS · React 19.2 · PostgreSQL 18 · Redis 8.6 · Debian 13 (trixie).

---

## Arquitectura

```
mediasswint/
├── apps/
│   └── web/                        # Next.js 16.2.4 (App Router, TS, standalone)
│       ├── app/
│       │   └── api/health/         # Healthcheck (app + postgres + redis)
│       └── Dockerfile              # Multi-stage: base, deps, builder, dev, runner
├── packages/                       # workspaces compartidos (vacío por ahora)
├── docker/
│   └── docker-compose.dev.yml      # dev dockerizado (target dev + bind mount)
├── docker-compose.yml              # prod-like / Coolify (target runner)
├── .github/
│   ├── workflows/                  # ci-pr, ci-main, deploy-coolify
│   └── renovate.json               # política de updates
├── .env.example
├── .nvmrc                          # 24.15.0 (host recomendado)
├── pnpm-workspace.yaml
└── package.json                    # raíz (scripts del monorepo)
```

**Principio:** toda la app se ejecuta dentro de Docker (dev y prod). El host solo necesita Docker. Node local es opcional (ayuda a IDEs y scripts puntuales fuera del contenedor).

---

## Quickstart (Docker-first)

### Requisitos del host

- **Docker** 24+ y **Docker Compose v2**
- *(Opcional)* Node 24.15.0 + pnpm 10, solo si querés instalar deps fuera del contenedor para tu IDE (ver `.nvmrc`)

### 1. Clonar y preparar `.env`

```bash
git clone https://github.com/sebasttiant/mediasswint.git
cd mediasswint
cp .env.example .env
```

### 2. Levantar el stack de desarrollo (hot reload)

```bash
pnpm infra:dev        # docker compose -f docker/docker-compose.dev.yml up -d --build
```

Esto construye la imagen `mediasswint/web:dev` (target `dev`), monta `apps/web/` como bind mount y arranca web + postgres + redis en contenedores.

### 3. Ver estado y logs

```bash
pnpm infra:dev:ps
pnpm infra:dev:logs
```

### 4. Validar healthcheck

```bash
curl -s http://localhost:3131/api/health | jq
```

Respuesta esperada (HTTP 200):

```json
{
  "app": { "ok": true },
  "services": {
    "postgres": { "ok": true, "latency_ms": 8 },
    "redis":    { "ok": true, "latency_ms": 3 }
  }
}
```

### 5. Parar el stack

```bash
pnpm infra:dev:down
```

Los datos de Postgres y Redis persisten en volúmenes nombrados (ver *Persistencia*).

---

## Stack "prod-like" local

Para probar el build standalone exacto que va a producción:

```bash
cp .env.example .env
docker compose up -d --build
curl http://localhost:3131/api/health
```

Se construye el Dockerfile target `runner` (image `mediasswint/web:latest`), corre como usuario no-root dentro del contenedor.

---

## Persistencia y reinicio automático

| Servicio | Imagen | Volumen persistente | Durabilidad | Restart policy |
|---|---|---|---|---|
| postgres | `postgres:18-alpine` | `mediasswint_postgres_data` | WAL + fsync (default postgres) | `unless-stopped` |
| redis | `redis:8.6-alpine` | `mediasswint_redis_data` | **AOF** `everysec` | `unless-stopped` |
| web | build local `apps/web/Dockerfile` | — *(stateless)* | — | `unless-stopped` |

Los volúmenes sobreviven a `docker compose down` y a reinicios del host. Para borrarlos (reset completo):

```bash
docker compose down -v      # ojo: borra data de postgres y redis
```

Redis está configurado con **AOF habilitado** (`--appendonly yes --appendfsync everysec`) para no perder escrituras recientes ante caídas.

---

## Variables de entorno

Ver `.env.example` (único source-of-truth). Nunca commitear `.env` real — está en `.gitignore`.

| Var | Default dev | Uso |
|---|---|---|
| `NODE_ENV` | `development` | modo de Next |
| `APP_PORT` | `3131` | puerto expuesto al host |
| `POSTGRES_USER` / `_PASSWORD` / `_DB` | `mediass` / `mediass` / `mediass` | credenciales dev del contenedor postgres |
| `DATABASE_URL` | `postgresql://mediass:mediass@localhost:5432/mediass` | conexión desde host (si corrés `pnpm dev` fuera de docker) |
| `REDIS_URL` | `redis://localhost:6379` | conexión desde host |
| `AUTH_USER` | — | email del usuario inicial para el bootstrap one-off |
| `AUTH_PASSWORD` | — | contraseña inicial para el bootstrap one-off |
| `AUTH_SECRET` | `change-this-in-prod` | firma de cookie de sesión |

**Dentro** de docker compose, la app usa hostnames de la red interna (`postgres`, `redis`). El compose inyecta las URLs correctas automáticamente.

---

## CI/CD

Workflows en `.github/workflows/`:

| Workflow | Trigger | Qué hace |
|---|---|---|
| `ci-pr.yml` | PR → `main` (con paths filter) | lint + typecheck + build + docker build (cache GHA) |
| `ci-main.yml` | push → `main` | validación full + build runner tageado `main-${sha}` |
| `deploy-coolify.yml` | `workflow_dispatch` | trigger webhook de Coolify con secrets |

Node version: leída de `.nvmrc`. pnpm cache habilitado. Builds de Docker cachean capas con `type=gha`.

### Secrets requeridos (GitHub)

- `COOLIFY_WEBHOOK_URL` — endpoint del webhook de deploy
- `COOLIFY_TOKEN` — bearer token para autenticar

---

## Deploy en Coolify

1. En Coolify crear un proyecto nuevo apuntando al repo `https://github.com/sebasttiant/mediasswint.git`.
2. Seleccionar "Docker Compose" y apuntar a `docker-compose.yml` (archivo raíz).
3. Definir variables de entorno (`POSTGRES_*`, `APP_PORT`, etc.).
4. Copiar el webhook URL y token → guardarlos en GitHub Secrets como `COOLIFY_WEBHOOK_URL` y `COOLIFY_TOKEN`.
5. Deploy manual: `Actions` → `Deploy (Coolify)` → `Run workflow` → elegir environment.

Coolify se encarga del TLS, dominios y health monitoring.

### Bootstrap del usuario inicial (one-off)

Tras el primer deploy, la tabla `User` arranca vacía. Para provisionar el usuario inicial sin meter el script en la imagen `runner`, el Dockerfile expone un stage `bootstrapper` que hereda de `builder` (source + deps completas) y se ejecuta a demanda:

```bash
# 1. Build puntual del target bootstrapper
docker build --target bootstrapper -t mediasswint/bootstrapper:latest -f apps/web/Dockerfile .

# 2. Ejecutar one-off contra la DB destino
docker run --rm \
  --network <stack-network> \
  -e DATABASE_URL="postgresql://<user>:<pass>@postgres:5432/<db>" \
  -e AUTH_USER="admin@tu-dominio.com" \
  -e AUTH_PASSWORD="<contraseña-fuerte>" \
  mediasswint/bootstrapper:latest
```

En Coolify se dispara como "one-off command" sobre la imagen del target `bootstrapper`, pasando las mismas tres variables. Es idempotente: si el email ya existe, actualiza el hash.

---

## Política de actualización de dependencias (Renovate)

Configurado en `.github/renovate.json`:

| Tipo | Frecuencia | Automerge |
|---|---|---|
| **Patch** | semanal (fin de semana), agrupado | ❌ requiere merge manual con CI verde |
| **Minor** | **quincenal** (sábado cada 2 semanas), agrupado | ❌ merge manual |
| **Major** | sólo cuando lo aprobás desde el **Dependency Dashboard** | ❌ merge manual |
| **Docker base images** | quincenal | ❌ |
| **GitHub Actions** | mensual | ❌ |
| **Vulnerabilidades** | inmediato con label `security` | ❌ |

**Regla de merge:** ningún PR de Renovate se mergea si CI no está 100% verde.

Para activar Renovate en el repo: instalar la [Renovate GitHub App](https://github.com/apps/renovate) en la cuenta y darle acceso a `mediasswint`.

---

## Contrato de versión Node

| Contexto | Versión | Source of truth |
|---|---|---|
| Runtime (contenedor) | `node:24.15.0-trixie-slim` | `apps/web/Dockerfile` |
| Host recomendado | `24.15.0` | `.nvmrc` |
| `engines.node` | `>=24.15.0 <25` | `package.json` raíz |
| CI GitHub Actions | lee `.nvmrc` | workflows |

**Qué pasa si el host tiene Node 22 o cualquier otra versión:** la app igual funciona porque se ejecuta en Docker. El `.nvmrc` solo ayuda a herramientas de IDE o si usás `pnpm` fuera del contenedor.

---

## Scripts útiles

| Comando | Qué hace |
|---|---|
| `pnpm infra:dev` | build + up del stack dev (con hot reload) |
| `pnpm infra:dev:down` | stop stack dev |
| `pnpm infra:dev:logs` | logs en vivo dev |
| `pnpm infra:dev:ps` | estado contenedores dev |
| `pnpm docker:up` | stack prod-like local (compose raíz) |
| `pnpm docker:down` | stop stack prod-like |
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | delega a `@mediasswint/web` |
| `pnpm --filter @mediasswint/web prisma:validate` | valida schema Prisma v0 |
| `pnpm --filter @mediasswint/web prisma:migrate:dev` | crea/aplica migraciones Prisma |

---

## Decisiones de modelado (Prisma v0)

- El dominio inicial cubre `Patient`, `MeasurementTemplate`, `TemplateSection`, `TemplateField`, `MeasurementSession` y `MeasurementValue`.
- Se priorizó trazabilidad y evolución: todas las entidades tienen `createdAt` y `updatedAt`.
- `MeasurementValue` soporta tipos múltiples (`valueText`, `valueNumber`, `valueBoolean`) para evitar rediseño prematuro del storage.
- `MeasurementSession` permite `templateId` nullable para capturas históricas/legacy sin romper integridad del paciente.
- Índices iniciales enfocados en consultas de operación: paciente+fecha, estado de sesión, orden de secciones/campos.

---

## Estado actual

Etapa 1 — bootstrap production-ready + Prisma v0 inicial. Sin ETL, sin features de negocio finales.
El healthcheck `/api/health` solo valida conectividad con Postgres y Redis.
