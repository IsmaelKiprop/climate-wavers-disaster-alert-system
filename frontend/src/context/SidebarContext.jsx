import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "cw_sidebar_collapsed";
const SidebarContext = createContext(null);

function readCollapsed() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    // Ignore private-mode storage errors.
  }
  if (typeof window === "undefined") return false;
  return window.innerWidth < 1280;
}

export function SidebarProvider({ children }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // Ignore private-mode storage errors.
    }
  }, [collapsed]);

  const toggle = () => setCollapsed((value) => !value);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    return { collapsed: false, setCollapsed: () => {}, toggle: () => {} };
  }
  return context;
}
