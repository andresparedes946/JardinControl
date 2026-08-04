import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth.config";
import { INICIO, RUTAS_ABIERTAS, RUTAS_PUBLICAS } from "@/lib/rutas";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const sesion = req.auth;

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

  // Con sesión activa, /login y / no tienen sentido.
  if (esPublica || pathname === "/") {
    return NextResponse.redirect(new URL(INICIO, req.nextUrl));
  }

  // Ya no hace falta separar por rol: solo la dirección puede iniciar sesión
  // —lo impone `authorize` en src/lib/auth.ts—, así que cualquiera que llegue
  // hasta acá con sesión es admin. Las guardas de cada page siguen igual.
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
