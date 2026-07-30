import type { Metadata } from "next";
import localFont from "next/font/local";
import { NavBar } from "@/components/nav-bar";
import "./globals.css";

const inter = localFont({
  src: "../fonts/Inter-Variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "../fonts/JetBrainsMono-Variable.woff2",
  variable: "--font-jetbrains-mono",
  weight: "100 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ToDoList",
  description: "A ToDo list app used for observability/debugging training.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-canvas">
        <NavBar />
        <main className="mx-auto w-full max-w-container flex-1 px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
