import type { DefaultSession } from "next-auth";

import type { Rol } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface User {
    rol: Rol;
    /** null para el admin, que no es empleado del jardín. */
    empleadoId: string | null;
  }

  interface Session {
    user: {
      id: string;
      rol: Rol;
      empleadoId: string | null;
    } & DefaultSession["user"];
  }
}

// `next-auth/jwt` solo reexporta `@auth/core/jwt`, y una reexportación no
// sirve como destino de declaration merging: hay que augmentar el módulo real.
declare module "@auth/core/jwt" {
  interface JWT {
    rol: Rol;
    empleadoId: string | null;
  }
}
