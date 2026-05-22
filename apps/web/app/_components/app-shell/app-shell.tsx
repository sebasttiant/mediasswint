import type { ReactNode } from "react";
import Link from "next/link";

import {
  APP_SHELL_NAVIGATION,
  buildAppShellAriaLabel,
  findAppShellActiveItem,
  getDashboardNavigationItem,
} from "./navigation";
import styles from "./app-shell.module.css";

type AppShellProps = {
  children: ReactNode;
  currentPath: string;
  title: string;
  kicker: string;
  description?: string;
  userLabel?: string;
  actions?: ReactNode;
};

export function AppShell({
  actions,
  children,
  currentPath,
  description,
  kicker,
  title,
  userLabel,
}: AppShellProps) {
  const activeItem = findAppShellActiveItem(currentPath) ?? getDashboardNavigationItem();

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Navegación principal">
        <Link className={styles.brand} href="/" aria-label="Volver al dashboard principal">
          <span className={styles.brandMark}>M</span>
          <span>
            <strong>MEDIASSWINT</strong>
            <small>Gestión interna</small>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Módulos">
          {APP_SHELL_NAVIGATION.map((item) => {
            const active = item.key === activeItem.key;

            return (
              <div className={styles.navGroup} key={item.key}>
                <Link
                  aria-current={active ? "page" : undefined}
                  aria-label={buildAppShellAriaLabel(item, active)}
                  className={active ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
                  href={item.href}
                >
                  <span>{item.label}</span>
                  <small>{item.description}</small>
                </Link>
                {item.children && active ? (
                  <div className={styles.subnav} aria-label={`${item.label} submenú`}>
                    {item.children.map((child) => (
                      <Link className={styles.subnavLink} href={child.href} key={`${item.key}-${child.label}`}>
                        <span>{child.label}</span>
                        <small>{child.description}</small>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.titleBlock}>
            <Link className={styles.dashboardReturn} href="/">
              ← Dashboard
            </Link>
            <p className={styles.kicker}>{kicker}</p>
            <h1>{title}</h1>
            {description ? <p className={styles.description}>{description}</p> : null}
            <p className={styles.context}>Sección activa: {activeItem.label}</p>
          </div>
          <div className={styles.actions}>
            {userLabel ? <span className={styles.userLabel}>{userLabel}</span> : null}
            {actions}
          </div>
        </header>

        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}
