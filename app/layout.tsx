import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "O que fazer? — sua lista de ideias",
  description:
    "Guarde ideias para viver, aprender e realizar, e escolha seu próximo passo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        {children}
        <Script id="theme-preference" strategy="beforeInteractive">
          {`try { if (localStorage.getItem("o-que-fazer:theme:v1") === "dark") document.documentElement.dataset.theme = "dark"; } catch {}`}
        </Script>
      </body>
    </html>
  );
}
