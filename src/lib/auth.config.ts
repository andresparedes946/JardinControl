import type { NextAuthConfig } from "next-auth";

/**
 * Configuración compartida entre el middleware (runtime edge) y el servidor.
 *
 * El middleware no puede importar Prisma ni bcrypt, así que acá va solo lo
 * que corre en ambos entornos. El provider de credenciales vive en auth.ts.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.rol = user.rol;
        token.empleadoId = user.empleadoId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.rol = token.rol;
        session.user.empleadoId = token.empleadoId;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
