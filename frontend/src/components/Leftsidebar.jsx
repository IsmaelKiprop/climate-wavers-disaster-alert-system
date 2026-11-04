import AppNav from "./app/AppNav";
import { useSidebar } from "../context/SidebarContext";

const Leftsidebar = () => {
  const { collapsed } = useSidebar();
  return <AppNav compact={collapsed} />;
};

export default Leftsidebar;
