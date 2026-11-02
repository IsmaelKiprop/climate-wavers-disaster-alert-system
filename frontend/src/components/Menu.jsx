import AppNav from "./app/AppNav";
import { useSidebar } from "../context/SidebarContext";

const Menu = ({ setIsOpen }) => {
  const { collapsed } = useSidebar();
  return <AppNav compact={collapsed} onNavigate={() => setIsOpen?.(false)} />;
};

export default Menu;
