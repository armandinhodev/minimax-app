"use client";

/**
 * The routes of the active area.
 *
 * The transport chooses the area; this row chooses the route inside it. It
 * stays hidden for areas with a single route (Library), where it would repeat
 * the transport and add nothing.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavItemActive } from "./nav-config";
import { activeSection } from "./TransportNav";
import styles from "./navigation.module.css";

export function AreaSubnav() {
  const pathname = usePathname();
  const section = activeSection(pathname);

  if (!section || section.groups.length === 0) return null;

  const items = section.groups.flatMap((group) => group.items);

  return (
    <div className={styles.subnav}>
      <div className={styles.subnavIntro}>
        <span className={styles.subnavArea}>{section.label}</span>
        <span className={styles.subnavDescription}>{section.description}</span>
      </div>

      <nav aria-label={`${section.label} routes`} className={styles.subnavNav}>
        <ul className={styles.subnavLinks}>
          {items.map((item) => {
            const isActive = isNavItemActive(pathname, item);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={styles.subnavLink}
                  data-active={isActive ? "true" : "false"}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
