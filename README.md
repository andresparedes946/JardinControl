# JardinControl

Sistema de gestión de personal del jardín **Mundo Feliz**: fichaje de ingreso
y egreso con reconocimiento facial restringido al radio del jardín, cálculo de
horas y sueldos, licencias y carga de comprobantes. Es una PWA instalable,
pensada para que cada empleada fiche desde su propio celular.

## Stack

| Área | Elección |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| UI | TailwindCSS v4, shadcn/ui (Base UI) |
| Datos | Prisma 7 + PostgreSQL (Supabase) |
| Auth | Auth.js v5, credenciales + bcrypt, sesión JWT |
| Archivos | Supabase Storage (bucket privado + signed URLs) |
| Facial | `@vladmandic/human` (embedding + antispoof + liveness) |
| PWA | `@serwist/next` |

## Puesta en marcha

1. **Crear el proyecto en Supabase** y copiar las cadenas de conexión.

2. **Configurar el entorno**: copiar `.env.example` a `.env` y completar.
   Ojo con las dos URLs, no son intercambiables:
   - `DATABASE_URL` → pooled, puerto **6543**, con `?pgbouncer=true`. La usa la app.
   - `DIRECT_URL` → directa, puerto **5432**. La usa `prisma migrate`.

3. **Instalar, migrar y sembrar**:

```bash
npm install && npm run db:migrate && npm run db:seed
```

4. **Levantar**:

```bash
npm run dev
```

### Probar en un celular

La cámara y el GPS **solo funcionan sobre HTTPS**. Para probar en un teléfono
real hace falta un túnel (`cloudflared tunnel --url http://localhost:3000`) o
un deploy de preview. `http://` sobre una IP de LAN no sirve.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Genera el cliente Prisma y compila |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Crea y aplica una migración |
| `npm run db:seed` | Carga datos iniciales (idempotente) |
| `npm run db:studio` | Prisma Studio |
| `npm run iconos` | Regenera los íconos de la PWA |

## Decisiones que conviene conocer

- **La decisión del fichaje vive en el servidor.** El navegador calcula el
  descriptor facial y lee el GPS, pero quién compara, quién mide la distancia
  y quién resuelve si es ingreso o egreso es siempre el backend. Todo intento
  queda registrado en la tabla `fichajes`, incluidos los rechazados, con la
  distancia y la precisión que reportó el dispositivo.
- **Solo se guardan vectores faciales, nunca fotos.** Las capturas del
  enrolamiento se descartan apenas se calcula el embedding.
- **Las horas se calculan en UTC y se muestran en hora de Buenos Aires.**
  Ver `src/lib/time.ts`: mezclarlas corre un día los fichajes de la noche.
- **La geocerca acepta cuando el círculo de incertidumbre del GPS se
  superpone con el radio**, y descarta de entrada las lecturas demasiado
  imprecisas. Sin ese corte, un `accuracy` grande volvería la geocerca
  inútil. Ver `src/lib/geo.ts`.

## Estado

Fase 0 (andamiaje) terminada. El detalle de las fases siguientes está en
`EstructuraJardin.md` y en el plan de implementación.
