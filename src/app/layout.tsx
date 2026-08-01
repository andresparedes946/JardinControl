import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Proveedores } from "@/components/proveedores";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "JardinControl",
    template: "%s · JardinControl",
  },
  description:
    "Fichaje con reconocimiento facial, licencias y sueldos del jardín.",
  applicationName: "JardinControl",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "JardinControl",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  // La pantalla de fichaje usa la cámara a pantalla completa en el celular:
  // el zoom por doble toque solo estorba.
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Proveedores>{children}</Proveedores>
      </body>
    </html>
  );
}
