import { compare } from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { registrarAuditoria } from "@/lib/auditoria";
import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";

const credencialesSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credenciales) {
        const parseado = credencialesSchema.safeParse(credenciales);
        if (!parseado.success) return null;

        const usuario = await prisma.usuario.findUnique({
          where: { email: parseado.data.email.toLowerCase() },
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
            password: true,
            rol: true,
            activo: true,
            empleado: { select: { id: true } },
          },
        });

        // Se compara el hash aunque el usuario no exista o esté inactivo:
        // devolver antes filtraría por tiempo de respuesta qué emails están
        // dados de alta.
        const hash =
          usuario?.password ??
          "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu";
        const coincide = await compare(parseado.data.password, hash);

        // Solo la dirección tiene cuenta. Desde que el fichaje es por QR con
        // DNI y PIN, una maestra no necesita iniciar sesión, y las cuentas que
        // le quedaron de antes no tienen que servir para entrar: su fila de
        // `usuarios` sigue existiendo porque es donde viven su nombre y su
        // email, no para darle acceso.
        const puedeEntrar = usuario?.rol === "ADMIN";

        // El acceso se audita de los dos lados. Un registro que solo guarda lo
        // que salió bien no sirve para lo que se consulta una auditoría: una
        // seguidilla de intentos fallidos a las tres de la mañana es
        // exactamente el rastro que hay que poder ver. El motivo se guarda
        // porque quien lo lee ya es la dirección; al que intenta entrar se le
        // sigue devolviendo el mismo error genérico.
        if (!usuario || !usuario.activo || !puedeEntrar || !coincide) {
          await registrarAuditoria({
            usuarioId: usuario?.id ?? null,
            accion: "LOGIN_FALLIDO",
            entidad: "Usuario",
            entidadId: usuario?.id ?? null,
            detalle: {
              email: parseado.data.email,
              motivo: !usuario
                ? "email inexistente"
                : !usuario.activo
                  ? "usuario inactivo"
                  : !puedeEntrar
                    ? "la cuenta no es de la dirección"
                    : "contraseña incorrecta",
            },
          });

          return null;
        }

        await registrarAuditoria({
          usuarioId: usuario.id,
          accion: "INICIAR_SESION",
          entidad: "Usuario",
          entidadId: usuario.id,
        });

        return {
          id: usuario.id,
          name: `${usuario.nombre} ${usuario.apellido}`,
          email: usuario.email,
          rol: usuario.rol,
          empleadoId: usuario.empleado?.id ?? null,
        };
      },
    }),
  ],
});
