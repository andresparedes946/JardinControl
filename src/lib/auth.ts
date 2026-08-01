import { compare } from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

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

        if (!usuario || !usuario.activo || !coincide) return null;

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
