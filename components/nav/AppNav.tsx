"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";
import Sidebar from "./Sidebar";

/**
 * Punto di ingresso unico per la navigazione dello shell: renderizza sia la
 * sidebar desktop che la bottom nav mobile, ciascuna nascosta via CSS al
 * breakpoint dove non serve (vedi Sidebar.tsx / BottomNav.tsx). Nessuna nav
 * sulla pagina di login: link a pagine protette che rimbalzerebbero comunque
 * a /login non hanno senso lì.
 */
export default function AppNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <>
      <Sidebar />
      <BottomNav />
    </>
  );
}
