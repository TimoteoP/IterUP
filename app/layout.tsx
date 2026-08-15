import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { colors, font } from "@/lib/design-tokens";
import AppNav from "@/components/nav/AppNav";
import ServiceWorkerRegister from "@/components/pwa/ServiceWorkerRegister";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "IterUp",
  description:
    "IterUp — traccia dieta, macro, peso, attività fisica e abitudini in un unico posto.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "IterUp",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: colors.background,
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{
          backgroundColor: colors.background,
          color: colors.textPrimary,
          fontFamily: font.sans,
        }}
      >
        <ServiceWorkerRegister />
        <AppNav />
        <main className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0 md:pl-56">
          {children}
        </main>
      </body>
    </html>
  );
}
