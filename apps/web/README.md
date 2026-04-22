# @mediasswint/web

Aplicación web de MEDIASSWINT (Next.js 16.2.4, App Router, TypeScript).

## Ejecución

Este workspace está pensado para correr dentro de Docker Compose desde la raíz del monorepo.

Desde `mediasswint/`:

```bash
pnpm infra:dev
```

La app queda disponible en `http://localhost:3000`.

## Scripts del workspace

Desde la raíz:

```bash
pnpm --filter @mediasswint/web lint
pnpm --filter @mediasswint/web typecheck
pnpm --filter @mediasswint/web build
```

## Healthcheck

Endpoint: `GET /api/health`

- Verifica app viva
- Ejecuta `SELECT 1` contra PostgreSQL
- Ejecuta `PING` contra Redis
- Devuelve `200` si ambos servicios están OK, `503` si alguno falla

Prueba rápida:

```bash
curl -s http://localhost:3000/api/health | jq
```

## Notas técnicas

- `next.config.ts` usa `output: "standalone"` para imagen de runtime liviana
- El Dockerfile define targets `dev` y `runner`
- Runtime productivo corre como usuario no-root
