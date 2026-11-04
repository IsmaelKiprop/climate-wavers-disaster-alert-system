import { IoChevronBack, IoChevronForward } from "react-icons/io5";
import { useSidebar } from "../context/SidebarContext";

const DashboardSidebar = ({ children }) => {
  const { collapsed, toggle } = useSidebar();

  return (
    <aside
      className={`hidden md:flex flex-col bg-sidebar border-r border-border h-full shrink-0 overflow-hidden z-30 transition-[width] duration-200 ease-out motion-reduce:transition-none ${
        collapsed ? "w-[72px]" : "w-[220px] lg:w-[248px]"
      }`}
    >
      <div className={`flex items-center border-b border-border shrink-0 ${collapsed ? "justify-center p-2" : "justify-end px-2 py-2"}`}>
        <button
          type="button"
          onClick={toggle}
          className="p-2 hover:bg-background text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <IoChevronForward size={18} /> : <IoChevronBack size={18} />}
        </button>
      </div>
      <div className={`flex-1 overflow-y-auto ${collapsed ? "p-2" : "p-3"}`}>{children}</div>
    </aside>
  );
};

export default DashboardSidebar;
