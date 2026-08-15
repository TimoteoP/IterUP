import BottomNav from "./BottomNav";
import Sidebar from "./Sidebar";

/**
 * Punto di ingresso unico per la navigazione dello shell: renderizza sia la
 * sidebar desktop che la bottom nav mobile, ciascuna nascosta via CSS al
 * breakpoint dove non serve (vedi Sidebar.tsx / BottomNav.tsx).
 */
export default function AppNav() {
  return (
    <>
      <Sidebar />
      <BottomNav />
    </>
  );
}
