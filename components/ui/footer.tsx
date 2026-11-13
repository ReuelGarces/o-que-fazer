"use client";

import { DIcons } from "dicons";
import { useLenis } from "lenis/react";
import { House } from "lucide-react";

type FooterProps = {
  githubUrl?: string;
  linkedinUrl?: string;
};

export default function Footer({
  githubUrl = "https://github.com/ReuelGarces",
  linkedinUrl = "https://www.linkedin.com/in/reuel-garces",
}: FooterProps) {
  const lenis = useLenis();

  return (
    <footer className="footer" id="rodape">
      <nav aria-label="Links do rodapé" className="footer-icon-nav">
        <a
          aria-label="GitHub de Reuel Garcês (abre em nova aba)"
          className="footer-icon-link"
          href={githubUrl}
          rel="noopener noreferrer"
          target="_blank"
          title="GitHub"
        >
          <svg aria-hidden="true" width={21} height={21} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 .75a11.25 11.25 0 0 0-3.558 21.923c.563.104.768-.244.768-.542 0-.267-.01-.975-.015-1.914-3.13.68-3.791-1.508-3.791-1.508-.512-1.3-1.25-1.646-1.25-1.646-1.022-.699.078-.685.078-.685 1.13.08 1.725 1.16 1.725 1.16 1.005 1.723 2.637 1.225 3.278.937.102-.728.393-1.225.715-1.507-2.498-.284-5.124-1.249-5.124-5.562 0-1.229.44-2.232 1.16-3.019-.116-.285-.503-1.43.11-2.98 0 0 .945-.302 3.094 1.153A10.79 10.79 0 0 1 12 6.18c.956.004 1.918.13 2.816.379 2.148-1.455 3.09-1.153 3.09-1.153.615 1.55.228 2.695.112 2.98.722.787 1.159 1.79 1.159 3.019 0 4.324-2.63 5.275-5.136 5.554.404.35.764 1.042.764 2.1 0 1.516-.014 2.74-.014 3.112 0 .301.203.651.774.54A11.25 11.25 0 0 0 12 .75Z" />
          </svg>
        </a>
        <a
          aria-label="Voltar ao início"
          className="footer-icon-link footer-icon-link--home"
          href="#inicio"
          onClick={(event) => {
            event.preventDefault();
            const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            if (lenis) {
              lenis.scrollTo(0, { immediate: reducedMotion, force: true });
            } else {
              window.scrollTo({ top: 0, behavior: reducedMotion ? "instant" : "smooth" });
            }
            window.history.replaceState(null, "", "#inicio");
            document.getElementById("hero-title")?.focus({ preventScroll: true });
          }}
          title="Início"
        >
          <House aria-hidden="true" size={21} strokeWidth={1.5} />
        </a>
        <a
          aria-label="LinkedIn (abre em nova aba)"
          className="footer-icon-link"
          href={linkedinUrl}
          rel="noopener noreferrer"
          target="_blank"
          title="LinkedIn"
        >
          <DIcons.LinkedIn aria-hidden="true" width={21} height={21} />
        </a>
      </nav>
      <p className="footer-note">© Reuel Garcês. Todos os direitos reservados.</p>
    </footer>
  );
}
