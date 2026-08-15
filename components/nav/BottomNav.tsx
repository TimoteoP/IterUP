"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { colors, font } from "@/lib/design-tokens";
import { NAV_LINKS, isNavLinkActive } from "./nav-links";

/**
 * Barra di navigazione inferiore, visibile solo su mobile (< md).
 * Su desktop la navigazione è affidata a <Sidebar />.
 */
export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigazione principale"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 flex md:hidden"
      style={{
        backgroundColor: colors.surface,
        borderTop: `1px solid ${colors.border}`,
      }}
    >
      <ul className="flex w-full items-stretch justify-between overflow-x-auto">
        {NAV_LINKS.map((link) => {
          const active = isNavLinkActive(pathname, link.href);
          return (
            <li key={link.href} className="flex-1 min-w-[3.5rem]">
              <Link
                href={link.href}
                className="flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
                style={{
                  color: active ? colors.primary : colors.textSecondary,
                  fontSize: font.size.xs,
                  fontWeight: active ? font.weight.semibold : font.weight.regular,
                }}
                aria-current={active ? "page" : undefined}
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  {link.icon}
                </span>
                <span className="leading-none whitespace-nowrap">{link.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
