Arquitectura del proyecto
JardinControl/
│
├── frontend/
│   ├── Next.js
│   ├── React
│   ├── TailwindCSS
│   ├── Shadcn UI
│   └── Face Recognition
│
├── backend/
│   ├── Next API
│   ├── Prisma
│   ├── PostgreSQL
│   └── JWT Auth
│
├── storage/
│   ├── Fotos empleados
│   └── Logos
│
└── docs/
    ├── API
    ├── Base de datos
    └── Manual
Stack tecnológico
Frontend
Next.js 15
React 19
TypeScript
TailwindCSS
Shadcn UI
React Hook Form
Zod
TanStack Query
Backend
Next.js API
Prisma ORM
PostgreSQL
JWT
bcrypt
Reconocimiento facial
Face API
Tensorflow.js
MediaPipe Face Detection

Todo funcionando directamente desde la cámara web.

FASE 1
Configuración

Objetivo:

Construir la base del sistema.

Incluye
Login
Roles
Layout
Sidebar
Dashboard vacío
Configuración inicial
Base de datos
ORM
Pantallas
Login

Dashboard

Configuración

Perfil
FASE 2
Gestión de empleados
CRUD completo

Cada empleado tendrá:

Nombre

Apellido

DNI

Legajo

Email

Teléfono

Cargo

Sala

Turno

Horario

Estado

También:

foto
usuario
contraseña
permisos
FASE 3
Registro facial

La primera vez:

La directora registra a la maestra.

Proceso:

Abrir cámara

↓

Tomar 10 fotografías

↓

Generar embedding facial

↓

Guardar descriptor

↓

Eliminar fotografías

No es necesario almacenar todas las fotos, sino únicamente los descriptores biométricos necesarios para el reconocimiento, reduciendo espacio y mejorando la privacidad.

FASE 4
Pantalla de ingreso

Al abrir:

--------------------------------

Bienvenido

[ Cámara ]

Mire a la cámara

● Detectando rostro...

--------------------------------

El sistema:

Detecta el rostro.

↓

Busca coincidencias.

↓

Reconoce.

↓

Registra ingreso.

↓

Muestra:

✔ Bienvenida

María López

Ingreso registrado

08:01
FASE 5
Registro automático

Si la persona ya ingresó:

Entrada

08:02

Cuando salga:

Salida

13:01

Calcula automáticamente:

Horas

4:59
FASE 6
Dashboard

Tarjetas

Presentes

Ausentes

Llegadas tarde

Licencias

Horas trabajadas

Gráficos

Asistencia mensual
Horas
Puntualidad
Inasistencias
FASE 7
Historial

Cada maestra tendrá

Calendario

↓

Mes

↓

Todos los registros

Ejemplo

24/07

Ingreso

07:59

Salida

13:03

Horas

5:04
FASE 8
Reportes

PDF

Excel

CSV

Por:

empleado
fecha
sala
turno
mes
FASE 9
Configuración

El administrador podrá definir

Horario

08:00

Tolerancia

10 minutos

Horario salida

13:00

Días laborales

Feriados

Vacaciones

FASE 10
Auditoría

Guardar todo

Usuario

Fecha

IP

Dispositivo

Sistema operativo

Navegador

Hora

Acción
Base de datos
usuarios
id

nombre

apellido

email

password

rol

activo

created_at
empleados
id

usuario_id

dni

telefono

direccion

fecha_nacimiento

cargo

turno

sala

foto

embedding

estado
asistencias
id

empleado_id

fecha

hora_ingreso

hora_salida

horas

minutos_tarde

estado
horarios
id

turno

hora_inicio

hora_fin

tolerancia
salas
id

nombre

color
auditoria
id

usuario

accion

fecha

ip

navegador

dispositivo
Estructura de carpetas
src/

app/

components/

features/

auth/

employees/

attendance/

face-recognition/

dashboard/

reports/

settings/

hooks/

lib/

services/

types/

utils/

prisma/

public/models/
Diseño de la interfaz

Un estilo moderno y minimalista similar a Notion o Linear:

Sidebar fija con iconos.
Dashboard con tarjetas KPI.
Tablas con búsqueda, filtros y paginación.
Modo claro/oscuro.
Responsive para PC, tablet y celular.
Colores suaves y tipografía limpia para facilitar el uso en un entorno educativo.