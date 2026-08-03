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

La cámara y el GPS **solo funcionan sobre HTTPS**: apuntar el teléfono a la IP
de LAN por `http://` no alcanza, el navegador bloquea la cámara sin decir por
qué. Con `npm run dev:https` el servidor levanta sobre TLS con un certificado
propio, que hay que generar una vez con la IP de esta máquina:

```bash
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout certificates/dev-key.pem -out certificates/dev-cert.pem \
  -subj "/CN=JardinControl dev" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:TU.IP.DE.LAN"
```

Se genera a mano y no con el mkcert que trae Next porque mkcert instala una CA
en el almacén de confianza del sistema, y eso abre un diálogo de Windows que
no siempre se puede atender. Al pasarle `--experimental-https-key` y `-cert`,
Next se saltea mkcert por completo.

Falta abrir el puerto: Windows bloquea la entrada por defecto, así que desde
un PowerShell **como administrador**, una vez:

```bash
New-NetFirewallRule -DisplayName "JardinControl dev 3000" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -Profile Private
```

Desde el teléfono, en la misma red, entrar a `https://<IP-de-la-PC>:3000` y
aceptar la advertencia de certificado (Configuración avanzada → Acceder al
sitio). Chrome sigue considerando la página contexto seguro y habilita la
cámara. `/certificates` está en `.gitignore`: la clave privada no va al repo.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run dev:https` | Igual, sobre TLS y abierto a la red, para probar cámara y GPS en un celular |
| `npm run build` | Genera el cliente Prisma y compila |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Crea y aplica una migración |
| `npm run db:seed` | Carga datos iniciales (idempotente) |
| `npm run db:studio` | Prisma Studio |
| `npm run iconos` | Regenera los íconos de la PWA |
| `npm run modelos` | Vuelve a bajar los modelos de reconocimiento facial a `public/models` |
| `npm run rostros` | Mide los enrolamientos guardados, para calibrar los umbrales con datos |

## Decisiones que conviene conocer

- **La decisión del fichaje vive en el servidor.** El navegador calcula el
  descriptor facial y lee el GPS, pero quién compara, quién mide la distancia
  y quién resuelve si es ingreso o egreso es siempre el backend. Todo intento
  queda registrado en la tabla `fichajes`, incluidos los rechazados, con la
  distancia y la precisión que reportó el dispositivo.
- **Solo se guardan vectores faciales, nunca fotos.** Las capturas del
  enrolamiento se descartan apenas se calcula el embedding.
- **Los modelos se sirven desde `public/models`, no desde el CDN del autor.**
  Están versionados en el repo (unos 10 MB) para que el fichaje no dependa de
  un tercero ni de una descarga en el momento. `npm run modelos` los rebaja.
- **`@vladmandic/human` está en `serverExternalPackages`.** Su `exports` mapea
  la condición `node` a un build que importa `@tensorflow/tfjs-node`, y sin
  eso el bundler del servidor lo resuelve y falla. Se usa únicamente desde el
  navegador, cargado con `next/dynamic` y `ssr: false`.
- **Al enrolar, la cara va siempre de frente.** Parece intuitivo pedir giros
  para juntar variedad de pose, y es peor: una cara de tres cuartos lleva
  menos información de identidad, así que se parece poco a la frontal de su
  propia dueña y bastante a la de cualquier otra. Medido con dos rostros, los
  giros dejaban 0.01 de separación entre el peor caso legítimo y el mejor
  impostor; de frente, 0.34.
- **Las horas se calculan en UTC y se muestran en hora de Buenos Aires.**
  Ver `src/lib/time.ts`: mezclarlas corre un día los fichajes de la noche.
- **La geocerca acepta cuando el círculo de incertidumbre del GPS se
  superpone con el radio**, y descarta de entrada las lecturas demasiado
  imprecisas. Sin ese corte, un `accuracy` grande volvería la geocerca
  inútil. Ver `src/lib/geo.ts`.

## Pendiente antes de usar esto en el jardín

1. **La base está en estado de prueba.** La geocerca apunta a un domicilio
   con radio de 100 m y `umbralAntispoof` está en 0.4. Se restaura al jardín
   real con `npm run db:seed`, que reescribe la configuración entera.
2. **Calibrar el antispoof.** Una maestra real en vivo puntuó 0.68 y el
   umbral original era 0.70: habría rechazado un fichaje legítimo. Falta
   medir cuánto puntúa un intento con una foto para poner el umbral entre
   los dos valores. Ver `npm run fichajes`.
3. **Probar el fichaje aceptado de punta a punta.** Lo único verificado con
   cámara y GPS reales es el rechazo por ubicación. Entrada, salida, cálculo
   de horas y jornada duplicada están escritos pero no ejercitados.

## Estado

Terminadas: Fase 0 (andamiaje), Fase 1 (ABM de empleados, configuración y
contraseñas) y Fase 2 (registro facial). El detalle de las fases siguientes
está en `EstructuraJardin.md` y en el plan de implementación.

El `similitudMinima` de la configuración queda en 0.5, contrastado con dos
rostros reales enrolados (`npm run rostros`):

| | similitud |
|---|---|
| Misma persona, contra su muestra frontal | 0.54 – 0.93 |
| Personas distintas, máximo cruzado | 0.19 |

Son dos personas, no una muestra estadística. La prueba de verdad llega con
el fichaje: la tabla `fichajes` guarda el `score_facial` de **todo** intento,
aceptado o rechazado, justamente para poder ajustar el umbral con intentos
reales en vez de suposiciones.
