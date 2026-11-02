import AppNav from "../app/AppNav";
import { useSidebar } from "../../context/SidebarContext";

const Leftsidebar = () => {
  const { collapsed } = useSidebar();
  return (
    <div className="h-full">
      <AppNav compact={collapsed} />
    </div>
  );
};

export default Leftsidebar;
