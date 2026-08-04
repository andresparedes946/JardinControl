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
| `npm run limpiar` | Cuenta los movimientos de prueba; con `-- --si` los borra |
| `npm run iconos` | Regenera los íconos de la PWA |
| `npm run modelos` | Vuelve a bajar los modelos de reconocimiento facial a `public/models` |
| `npm run rostros` | Mide los enrolamientos guardados, para calibrar los umbrales con datos |

## Puesta en producción (Vercel)

Vercel resuelve lo que en desarrollo cuesta: sirve la app por HTTPS en un
dominio real, y la cámara y el GPS solo funcionan en contexto seguro. Con eso
se termina el certificado autofirmado y la advertencia en cada teléfono.

1. **Importar el repo** desde el panel de Vercel. Se detecta Next.js solo; no
   hay que tocar el comando de build ni el directorio de salida.

2. **Cargar las variables de entorno**, las mismas seis de `.env.example`.
   Ojo con dos:
   - `AUTH_SECRET` tiene que ser **uno nuevo**, distinto del de desarrollo.
     Se genera con `npx auth secret`.
   - `DIRECT_URL` hace falta también en producción, aunque la app no la use en
     runtime: el build corre `prisma migrate deploy` y las migraciones no pasan
     por el pooler.

   No hace falta `AUTH_URL`: Auth.js detecta el host solo cuando corre en
   Vercel.

3. **Dejar la región por defecto.** Las funciones convienen pegadas a la base
   de datos y no a los usuarios, porque cada pantalla consulta varias veces y
   una sola ida y vuelta de más pesa más que la distancia al teléfono. Si la
   latencia desde Argentina llegara a molestar, lo que se mueve es el proyecto
   de Supabase, no Vercel.

4. **Cambiar las contraseñas iniciales.** El seed deja `Cambiar.2026` por
   defecto y está en el repo. Antes de que el sistema quede accesible desde
   internet hay que cambiarla desde "Mi perfil", o sembrar con
   `SEED_PASSWORD_ADMIN` y `SEED_PASSWORD_MAESTRAS` en el entorno.

5. **Limpiar los datos de prueba** con `npm run limpiar -- --si`, que borra
   fichajes, asistencias, licencias con sus archivos, liquidaciones y
   auditoría, y deja el padrón, los rostros enrolados y la configuración.

6. **Verificar la geocerca** en Configuración: si se movió el centro para
   probar fuera del jardín, hay que devolverlo. `npm run db:seed` reescribe la
   configuración entera con los valores del jardín.

Las migraciones se aplican en cada deploy porque el build es
`prisma generate && prisma migrate deploy && next build`. Es una migración
pendiente menos de la que acordarse, a cambio de que un deploy pueda tocar el
esquema de producción: conviene mirar qué hay en `prisma/migrations` antes de
publicar.

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
- **La maestra manda el certificado; la dirección carga los días.** En
  "Mis licencias" solo se adjunta el papel y, si hace falta, una aclaración:
  no hay tipo ni fechas para completar. El período que cubre una licencia lo
  dice el certificado, así que lo carga quien lo lee, al aprobarlo. Hasta
  entonces la licencia figura como "certificado recibido el …", sin período.
- **Aprobar una licencia escribe en las asistencias.** Los días laborales del
  rango quedan en estado LICENCIA, salteando feriados; si no, aparecerían como
  ausencias sin justificar en el historial y en la liquidación. Nunca se pisa
  un día con ingreso fichado ni una fila corregida a mano, y pasar una
  licencia aprobada a rechazada deshace la marca. Ver `src/lib/licencias.ts`.
- **El reporte que se ve es el que se baja.** La vista previa y el CSV salen
  del mismo objeto, con las filas ya formateadas como texto: no hay una
  consulta para la pantalla y otra para el archivo. Es la única forma de que
  el papel que se firma no diga algo distinto de lo que la dirección miró
  antes de apretar "descargar". Ver `src/lib/reportes.ts`.
- **El CSV va con punto y coma y con BOM.** Excel en configuración regional
  argentina usa la coma como separador decimal, así que un CSV separado por
  comas le entra todo en una sola columna; y sin el BOM lee el archivo como
  ANSI y "Corbalán" sale "CorbalÃ¡n". Las dos cosas se ven como manías hasta
  que alguien hace doble clic en el archivo.
- **El PDF se hace imprimiendo.** No hay librería de PDF: hay una hoja de
  estilos de impresión que saca la barra lateral, los filtros y el tema
  oscuro, y agrega un encabezado con el nombre del jardín y el período.
  "Guardar como PDF" del navegador hace el resto. Una dependencia para
  generar PDFs pesa más que el problema que resuelve.
- **No fichar todavía no es faltar.** A las 8 de la mañana ninguna maestra del
  turno tarde llegó tarde: su turno no empezó. El dashboard separa "sin fichar"
  (ya pasó su horario más la tolerancia) de "no empezó", porque contarlas todas
  como ausentes haría que el panel marque cinco ausencias cada mañana y nadie
  le crea nunca más. Ver `src/lib/dashboard.ts`.
- **Los gráficos son monocromos y el ámbar está reservado.** La paleta de la
  app no tiene color, así que las barras van en un gris de la escala y el
  ámbar significa una sola cosa en todo el sistema: llegó tarde. Como el color
  no puede ser el único canal, cada gráfico lleva leyenda, tooltip y una tabla
  desplegable con los mismos números.
- **Un día de licencia aprobada se paga a las horas del turno.** Si no, una
  maestra con certificado médico cobraría cero por esos días. En la
  liquidación las horas de licencia van en una columna aparte de las
  trabajadas, y la fila de `liquidaciones` guarda las dos por separado, para
  que el importe pueda explicarse. Ver `src/lib/sueldos.ts`.
- **La liquidación se congela a mano y no se recalcula sola.** Generar el mes
  copia el valor hora a cada fila: un aumento en septiembre no cambia lo que
  se pagó en agosto. Si después se corrige una asistencia, la pantalla avisa
  que la liquidación quedó desfasada, pero no la toca: pisar un importe ya
  pagado tiene que ser una decisión, no un efecto secundario.
- **Los importes se calculan en centavos con enteros.** En pesos con coma
  flotante quedan restos de centavo, y entonces el total del mes no da la
  suma de la columna. Ver `importe()` en `src/lib/sueldos.ts`.
- **Los comprobantes no tienen URL pública.** Viven en un bucket privado y se
  abren por `/api/comprobantes/[id]`, que comprueba quién pide —la dueña o la
  dirección— y redirige a una URL firmada de un minuto. Es una ruta y no una
  Server Action porque abrir una pestaña después de un `await` lo bloquea el
  navegador.
- **La auditoría se ve como tabla o como tarjetas según el ancho.** Cinco
  columnas no entran en un celular por más que se les recorte contenido, y
  arrastrar de costado para leer cada fila no es leer. Debajo de 1024 px va la
  misma información apilada; de ahí para arriba, la tabla, que es lo que sirve
  para barrer veinticinco filas de un vistazo. El corte está en `lg` y no en
  `md` porque entre 768 y 1024 px la tabla entra, pero le come el ancho a la
  columna del detalle hasta dejarlo en tres renglones: cabe y se lee peor.
- **La auditoría se escribió desde la Fase 1 y se pudo mirar en la Fase 9.**
  Es el orden que conviene: sumar la línea de registro mientras se escribe
  cada mutación no cuesta nada, y hacerlo al final obliga a repasarlas todas.
- **El acceso se audita también cuando falla.** Un registro que solo guarda lo
  que salió bien no sirve para lo que se consulta una auditoría: una seguidilla
  de intentos fallidos de madrugada es justamente el rastro que hay que poder
  ver. Queda el email tipeado y el motivo —email inexistente, cuenta inactiva,
  contraseña incorrecta— porque quien lo lee es la dirección; al que intenta
  entrar se le sigue devolviendo el mismo mensaje genérico de siempre.
- **`accion` es texto libre y la traducción vive en un mapa.** Una acción sin
  traducir se muestra con su nombre crudo en vez de romper la pantalla, y el
  mapa conserva las que ya no se producen —`SOLICITAR_LICENCIA`, de antes de
  que el circuito de licencias cambiara— porque las filas viejas siguen ahí y
  poder leerlas es para lo que existe el registro.
- **El sistema operativo no tiene columna: se deriva al mostrar.** Sale del
  `user_agent` que ya se guarda. Agregar la columna solo serviría de acá en
  adelante y dejaría en blanco todo lo registrado desde la Fase 1, que es
  precisamente lo que se va a consultar.
- **Las horas se calculan en UTC y se muestran en hora de Buenos Aires.**
  Ver `src/lib/time.ts`: mezclarlas corre un día los fichajes de la noche.
- **La geocerca acepta cuando el círculo de incertidumbre del GPS se
  superpone con el radio**, y descarta de entrada las lecturas demasiado
  imprecisas. Sin ese corte, un `accuracy` grande volvería la geocerca
  inútil. Ver `src/lib/geo.ts`.

## Pendiente antes de usar esto en el jardín

1. **Calibrar el antispoof.** Es lo más urgente: una maestra real en vivo
   puntuó 0.68 contra un umbral de 0.70, así que hoy el sistema rechazaría
   un fichaje legítimo por "parece una foto". Falta medir cuánto puntúa un
   intento con una foto para poner el umbral entre los dos valores; bajarlo
   a ojo solo cambia un error por el otro. Ver `npm run fichajes`.
2. **Probar el fichaje aceptado de punta a punta.** Lo único verificado con
   cámara y GPS reales es el rechazo por ubicación. Entrada, salida, cálculo
   de horas y jornada duplicada están escritos pero no ejercitados.

Para probar los dos puntos hace falta estar dentro de la geocerca. Fuera del
jardín, lo práctico es mover el centro a donde uno esté (Configuración →
"Usar mi ubicación actual") y restaurarlo después con `npm run db:seed`, que
reescribe la configuración entera.

## Estado

Todas las fases están terminadas: Fase 0 (andamiaje), Fase 1 (ABM de empleados,
configuración y contraseñas), Fase 2 (registro facial), Fase 3 (fichaje con
reconocimiento facial y geocerca), Fase 4 (asistencias para la dirección y mi
historial para la maestra), Fase 5 (licencias: envío de certificados y
resolución), Fase 6 (liquidación mensual de sueldos), Fase 7 (dashboard con
indicadores reales), Fase 8 (reportes exportables de asistencias, sueldos y
licencias) y Fase 9 (pantalla de auditoría). El detalle está en
`EstructuraJardin.md` y en el plan de implementación.

Lo que sigue no es una fase más sino la prueba en el jardín: los dos puntos
pendientes de abajo necesitan cámara, GPS y estar parado dentro de la geocerca.

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
