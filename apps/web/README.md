# @mediasswint/web

Aplicación web de MEDIASSWINT (Next.js 16.2.4, App Router, TypeScript).

## Ejecución

Este workspace está pensado para correr dentro de Docker Compose desde la raíz del monorepo.

Desde `mediasswint/`:

```bash
pnpm infra:dev
```

La app queda disponible en `http://localhost:3131`.

Ruta inicial: `http://localhost:3131/login` (auth básica interna con cookie httpOnly).

## Scripts del workspace

Desde la raíz:

```bash
pnpm --filter @mediasswint/web lint
pnpm --filter @mediasswint/web typecheck
pnpm --filter @mediasswint/web test:unit
pnpm --filter @mediasswint/web build
pnpm --filter @mediasswint/web prisma:validate
pnpm --filter @mediasswint/web prisma:migrate:dev
```

## Healthcheck

Endpoint: `GET /api/health`

- Verifica app viva
- Ejecuta `SELECT 1` contra PostgreSQL
- Ejecuta `PING` contra Redis
- Devuelve `200` si ambos servicios están OK, `503` si alguno falla

Prueba rápida:

```bash
curl -s http://localhost:3131/api/health | jq
```

## Notas técnicas

- `next.config.ts` usa `output: "standalone"` para imagen de runtime liviana
- El Dockerfile define targets `dev`, `runner` y `migrator`
- Runtime productivo corre como usuario no-root
- Prisma v0 vive en `apps/web/prisma/schema.prisma`

## Migraciones en despliegue

El compose de producción orquesta las migraciones como un paso bloqueante
previo al arranque de `web`:

1. `postgres` debe estar `service_healthy`
2. El servicio `migrate` (target `migrator`) corre
   `prisma migrate deploy`, deja un marker de éxito y queda vivo.
3. `web` arranca solo cuando `migrate` está `healthy`
   (`service_healthy`)

Si hay una migración pendiente y falla, `web` **no arranca** — el deploy
queda rojo explícitamente. Si no hay pendientes, `migrate` imprime
"No pending migrations to apply" y queda en estado healthy.

Este patrón es portable: funciona en `docker compose up` local y en
Coolify (que ejecuta compose nativamente). No requiere comandos
pre-deploy configurados fuera del repo.
