"use client";
import Link from "next/link";
import { SignIn6 } from "@/components/ui/sign-in-6";
import { useRouter } from "next/navigation";
import { useState, useRef, type FormEvent } from "react";
import { BookOpen, Compass, Mountain, Star, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { api, type Profile } from "@/lib/api";
const avatars = {
  compass: Compass,
  book: BookOpen,
  mountain: Mountain,
  star: Star,
};
const avatarNames = {
  compass: "Bússola",
  book: "Livro",
  mountain: "Montanha",
  star: "Estrela",
};
function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <Callout
      role="alert"
      tone="danger"
      title="Não foi possível continuar"
      icon={<AlertCircle size={18} />}
    >
      {message}
    </Callout>
  ) : null;
}
export function LoginForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await api("login", {
        method: "POST",
        body: JSON.stringify({
          username: data.get("username"),
          password: data.get("password"),
        }),
      });
      router.replace("/profiles");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Tente novamente.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return <SignIn6 busy={busy} error={error} onSubmit={submit} />;
}
export function ProfilePicker({
  initialProfiles,
}: {
  initialProfiles: Profile[];
}) {
  const router = useRouter();
  const [profiles, setProfiles] = useState(initialProfiles),
    [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  async function run(task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Tente novamente.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="account-shell">
      <section
        className="account-panel account-panel--profiles"
        aria-labelledby="profiles-title"
      >
        <Link prefetch={false} className="account-brand" href="/">
          O que fazer?
        </Link>
        <h1 id="profiles-title">Quem está usando?</h1>
        <p>Escolha seu perfil para encontrar suas ideias.</p>
        <ErrorNotice message={error} />
        <div className="profile-choices">
          {profiles.map((profile) => {
            const Icon =
              avatars[profile.avatar as keyof typeof avatars] || Compass;
            return (
              <div className="profile-choice" key={profile.id}>
                <button
                  className="profile-select"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api("profiles/select", {
                        method: "POST",
                        body: JSON.stringify({ profileId: profile.id }),
                      });
                      router.replace("/");
                      router.refresh();
                    })
                  }
                >
                  <Icon size={46} strokeWidth={1.4} aria-hidden="true" />
                  <span>{profile.name}</span>
                </button>
                <Button
                  disabled={busy}
                  variant="ghost"
                  onClick={() =>
                    setEditing(editing === profile.id ? null : profile.id)
                  }
                >
                  Editar perfil de {profile.name}
                </Button>
                {editing === profile.id && (
                  <form
                    className="account-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      void run(async () => {
                        const result = await api<{ profiles: Profile[] }>(
                          `profiles/${profile.id}`,
                          {
                            method: "PATCH",
                            body: JSON.stringify({
                              name: data.get("name"),
                              avatar: data.get("avatar"),
                            }),
                          },
                        );
                        setProfiles(result.profiles);
                        setEditing(null);
                      });
                    }}
                  >
                    <label className="form-field">
                      Nome
                      <input
                        name="name"
                        defaultValue={profile.name}
                        maxLength={40}
                        required
                      />
                    </label>
                    <label className="form-field">
                      Avatar
                      <select name="avatar" defaultValue={profile.avatar}>
                        {Object.keys(avatars).map((key) => (
                          <option key={key} value={key}>
                            {avatarNames[key as keyof typeof avatars]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button type="submit" variant="primary" disabled={busy}>
                      {busy ? "Salvando…" : "Salvar perfil"}
                    </Button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
        <Button
          disabled={busy}
          variant="ghost"
          onClick={() =>
            run(async () => {
              await api("logout", { method: "POST" });
              router.replace("/login");
              router.refresh();
            })
          }
        >
          Sair da conta
        </Button>
      </section>
    </main>
  );
}
