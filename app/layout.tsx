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
  const isDark = (await cookies()).get("theme")?.value === "dark";

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased ${
        isDark ? "dark" : ""
      }`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
