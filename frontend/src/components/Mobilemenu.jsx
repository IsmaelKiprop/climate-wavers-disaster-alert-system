import AppNav from "./app/AppNav";
import { IoClose } from "react-icons/io5";

const Mobilemenu = ({ setIsOpen }) => {
  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40"
        aria-label="Close menu"
        onClick={() => setIsOpen(false)}
      />
      <div className="relative h-full w-[min(84vw,320px)] bg-surface border-r border-border overflow-y-auto">
        <div className="flex items-center justify-between px-4 h-16 border-b border-border">
          <p className="text-sm font-semibold">Menu</p>
          <button type="button" className="p-2" aria-label="Close menu" onClick={() => setIsOpen(false)}>
            <IoClose size={20} />
          </button>
        </div>
        <div className="p-4">
          <AppNav onNavigate={() => setIsOpen(false)} />
        </div>
      </div>
    </div>
  );
};

export default Mobilemenu;
