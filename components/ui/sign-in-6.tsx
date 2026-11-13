"use client";

import Link from "next/link";
import { Compass, ArrowUpRight, AlertCircle } from "lucide-react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";

type SignIn6Props = {
  busy: boolean;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

/** Two-panel sign-in adapted to the application's shared-account authentication. */
export function SignIn6({ busy, error, onSubmit }: SignIn6Props) {
  return (
    <main className="account-shell sign-in-shell">
      <section className="sign-in-card" aria-labelledby="login-title">
        <div className="sign-in-story">
          <Link prefetch={false} className="sign-in-brand" href="/">
            <span className="sign-in-brand-mark"><Compass size={20} strokeWidth={1.5} aria-hidden="true" /></span>
            <span>O que fazer?</span>
          </Link>
          <div className="sign-in-story-copy">
            <p className="sign-in-quote">Toda grande conquista começa com uma pequena ideia.</p>
            <p className="sign-in-story-note">Guarde suas ideias. Escolha seu próximo passo.</p>
          </div>
          <span className="sign-in-story-footer">Um lugar para tudo o que você ainda quer viver.<ArrowUpRight size={20} aria-hidden="true" /></span>
        </div>
        <div className="sign-in-content">
          <div className="sign-in-heading">
            <h1 id="login-title">Que bom ter você aqui.</h1>
            <p>Entre com a conta compartilhada e escolha seu perfil.</p>
          </div>
          <form className="account-form sign-in-form" onSubmit={onSubmit} aria-busy={busy}>
            <label className="form-field" htmlFor="sign-in-username">
              Usuário
              <input id="sign-in-username" name="username" autoComplete="username" placeholder="Seu usuário" required maxLength={64} disabled={busy} />
            </label>
            <label className="form-field" htmlFor="sign-in-password">
              Senha
              <input id="sign-in-password" name="password" type="password" autoComplete="current-password" placeholder="Sua senha" required maxLength={256} disabled={busy} />
            </label>
            {error && <Callout role="alert" tone="danger" title="Não foi possível entrar" icon={<AlertCircle size={18} />}>{error}</Callout>}
            <Button className="sign-in-submit" disabled={busy} type="submit" variant="primary">
              {busy ? "Entrando…" : "Entrar"}<ArrowUpRight size={17} aria-hidden="true" />
            </Button>
          </form>
          <p className="sign-in-footnote">Uma conta, dois perfis. Cada ideia no seu lugar.</p>
        </div>
      </section>
    </main>
  );
}

export default SignIn6;
