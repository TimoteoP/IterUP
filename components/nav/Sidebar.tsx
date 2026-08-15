"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { colors, font, spacing, radius } from "@/lib/design-tokens";
import { NAV_LINKS, isNavLinkActive } from "./nav-links";

/**
 * Sidebar di navigazione, visibile solo da tablet/desktop in su (>= md).
 * Su mobile la navigazione è affidata a <BottomNav />.
 */
export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Navigazione principale"
      className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col md:flex"
      style={{
        backgroundColor: colors.surface,
        borderRight: `1px solid ${colors.border}`,
        padding: spacing.lg,
      }}
    >
      <div
        className="mb-2 flex items-center gap-2"
        style={{ padding: `${spacing.sm} ${spacing.sm}` }}
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center"
          style={{
            backgroundColor: colors.primary,
            color: colors.background,
            borderRadius: radius.md,
            fontWeight: font.weight.bold,
          }}
        >
          IU
        </span>
        <span
          style={{
            color: colors.textPrimary,
            fontSize: font.size.lg,
            fontWeight: font.weight.semibold,
          }}
        >
          IterUp
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_LINKS.map((link) => {
          const active = isNavLinkActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 transition-colors"
              style={{
                padding: `${spacing.sm} ${spacing.sm}`,
                borderRadius: radius.md,
                backgroundColor: active ? colors.primaryMuted : "transparent",
                color: active ? colors.primary : colors.textSecondary,
                fontSize: font.size.sm,
                fontWeight: active ? font.weight.semibold : font.weight.regular,
              }}
              aria-current={active ? "page" : undefined}
            >
              <span aria-hidden="true" className="text-base leading-none">
                {link.icon}
              </span>
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
