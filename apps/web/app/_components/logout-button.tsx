"use client";

import { useRouter } from "next/navigation";
import styles from "../dashboard.module.css";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleLogout} className={styles.logoutBtn}>
      Cerrar sesión
    </button>
  );
}
