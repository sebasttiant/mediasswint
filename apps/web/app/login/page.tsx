"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, LineChart, ShieldCheck, User, Users } from "lucide-react";

// NOTE: visual redesign only. Authentication behaviour is unchanged — same
// request body ({ user, password }), same endpoint, same redirect and error
// handling as before. Do not couple business logic into this component.
const BENEFITS = [
  { icon: Users, text: "Registro y consulta rápida de pacientes" },
  { icon: LineChart, text: "Histórico de medidas por fecha y evolución" },
  { icon: ShieldCheck, text: "Trazabilidad segura con usuarios y roles" },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user, password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({ error: "Credenciales inválidas" }))) as {
          error?: string;
        };
        setError(payload.error ?? "No se pudo iniciar sesión");
        return;
      }

      router.replace("/patients");
      router.refresh();
    } catch {
      setError("No se pudo iniciar sesión");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-brand-strong p-4 sm:p-6">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-3xl shadow-2xl lg:grid-cols-2">
        {/* Left: dark informative panel */}
        <aside className="relative flex flex-col justify-between gap-10 bg-slate-900 px-8 py-10 text-white sm:px-10 lg:py-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Medias Elásticas</p>
            <h1 className="mt-6 font-display text-3xl font-bold leading-tight sm:text-4xl">
              Sistema interno de gestión de pacientes
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-300">
              Control centralizado de pacientes, medidas, entregas e historial operativo.
            </p>
          </div>

          <ul className="flex flex-col gap-4">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="text-sm text-slate-200">{text}</span>
              </li>
            ))}
          </ul>
        </aside>

        {/* Right: white form panel */}
        <article className="bg-white px-8 py-10 sm:px-10 lg:py-12">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Acceso seguro</p>
          <h2 className="mt-3 font-display text-2xl font-bold text-slate-900">Iniciar sesión</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            Ingresa con tu usuario asignado para continuar.
          </p>

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Usuario o correo
              </span>
              <span className="relative">
                <User
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  value={user}
                  onChange={(event) => setUser(event.target.value)}
                  autoComplete="username"
                  required
                  placeholder="usuario@ilasesorias.com"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                />
              </span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Contraseña
              </span>
              <span className="relative">
                <Lock
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-11 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                >
                  {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </span>
            </label>

            {error ? (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 inline-flex h-11 items-center justify-center rounded-xl bg-brand text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Validando…" : "Ingresar al sistema"}
            </button>
          </form>
        </article>
      </section>
    </main>
  );
}
