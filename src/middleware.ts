import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth.config";
import {
  INICIO_POR_ROL,
  RUTAS_ABIERTAS,
  RUTAS_ADMIN,
  RUTAS_PUBLICAS,
} from "@/lib/rutas";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const sesion = req.auth;
  const rol = sesion?.user?.rol;

  const esPublica = RUTAS_PUBLICAS.some((r) => pathname.startsWith(r));

  // Antes que nada: la página del QR pasa siempre, haya sesión o no.
  if (RUTAS_ABIERTAS.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  if (!sesion) {
    if (esPublica) return NextResponse.next();

    const login = new URL("/login", req.nextUrl);
    // Se recuerda el destino para volver ahí después de iniciar sesión.
    if (pathname !== "/") login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  const inicio = INICIO_POR_ROL[rol ?? "EMPLEADO"];

  // Con sesión activa, /login y / no tienen sentido: se manda a su inicio.
  if (esPublica || pathname === "/") {
    return NextResponse.redirect(new URL(inicio, req.nextUrl));
  }

  const necesitaAdmin = RUTAS_ADMIN.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  );

  if (necesitaAdmin && rol !== "ADMIN") {
    return NextResponse.redirect(new URL(INICIO_POR_ROL.EMPLEADO, req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Se excluyen las rutas de Auth.js, los estáticos y los archivos de la PWA:
  // el service worker y el manifest tienen que servirse sin sesión.
  //
  // `apple-icon.png` e `icon.png` van en la lista por lo mismo que el manifest.
  // Son los que genera Next desde `src/app/`, y los pide el teléfono al
  // agregar la app a la pantalla de inicio, que es algo que se hace desde el
  // login y por lo tanto sin sesión: si el middleware los redirige, iOS recibe
  // HTML donde esperaba un PNG y deja un ícono genérico para siempre.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|apple-icon.png|icon.png|manifest.webmanifest|sw.js|icons/|models/|offline).*)",
  ],
};
