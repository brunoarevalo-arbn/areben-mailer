import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
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
  title: "Areben Mailer",
  description: "Email marketing propio",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Tema desde cookie (SSR) → sin flash. El toggle actualiza cookie + clase.
  const galletas = await cookies();
  const isDark = galletas.get("theme")?.value === "dark";
  // Mismo mecanismo para el ancho del menú: la clase define `--ancho-menu`
  // (ver globals.css) y de ahí la leen el sidebar y la barra de guardar.
  // Resuelto en el servidor porque el ancho ES layout: sin esto la página
  // pinta un cuadro con el menú desplegado y el editor salta.
  const plegado = galletas.get("menu")?.value === "plegado";

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased ${
        isDark ? "dark" : ""
      } ${plegado ? "menu-plegado" : ""}`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
