"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import styles from "./page.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
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
    <main className={styles.page}>
      <section className={styles.shell}>
        <aside className={styles.brandPanel}>
          <p className={styles.kicker}>MEDIASSWINT</p>
          <h1>Plataforma interna clínica</h1>
          <p className={styles.subtitle}>
            Gestión centralizada de pacientes, registro de sesiones y operación diaria con enfoque corporativo.
          </p>

          <ul className={styles.bullets}>
            <li>Flujo de trabajo rápido para recepción y seguimiento</li>
            <li>Base de datos unificada para trazabilidad</li>
            <li>Operación segura con acceso autenticado</li>
          </ul>
        </aside>

        <article className={styles.card}>
          <p className={styles.cardKicker}>Acceso seguro</p>
          <h2>Iniciar sesión</h2>
          <p className={styles.cardSubtitle}>Ingresá tus credenciales para continuar.</p>

          <form onSubmit={onSubmit} className={styles.form}>
            <label>
              Usuario
              <input value={user} onChange={(event) => setUser(event.target.value)} autoComplete="username" />
            </label>

            <label>
              Contraseña
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>

            <button type="submit" disabled={submitting}>
              {submitting ? "Validando..." : "Entrar al sistema"}
            </button>
          </form>

          {error ? <p className={styles.error}>{error}</p> : null}
        </article>
      </section>
    </main>
  );
}
