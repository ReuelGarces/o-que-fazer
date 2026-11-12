import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "O que fazer? — sua lista de ideias",
  description:
    "Guarde ideias para viver, aprender e realizar, e escolha seu próximo passo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
