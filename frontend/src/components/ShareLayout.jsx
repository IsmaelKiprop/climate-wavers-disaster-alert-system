import Topbar from "./Topbar";
import Leftsidebar from "./Leftsidebar";
import Rightsidebar from "./Rightsidebar";
import { Outlet } from "react-router-dom";
import Footer from "./FooterBar";

const SharedLayout = () => {
  return (
    <div className="bg-background text-foreground min-h-[100dvh] flex flex-col overflow-x-hidden">
      <header className="sticky top-0 z-50 bg-navbar border-b border-border">
        <Topbar />
      </header>

      <div className="flex flex-1 relative">
        <aside className="hidden md:block w-[220px] lg:w-[240px] bg-sidebar border-r border-border sticky top-16 h-[calc(100dvh-4rem)] overflow-y-auto shrink-0">
          <Leftsidebar />
        </aside>

        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 pb-24 md:pb-8">
            <Outlet />
          </div>
        </main>

        <aside className="hidden xl:block w-[240px] bg-sidebar border-l border-border sticky top-16 h-[calc(100dvh-4rem)] overflow-y-auto shrink-0">
          <Rightsidebar />
        </aside>
      </div>

      <div className="md:hidden">
        <Footer />
      </div>
    </div>
  );
};

export default SharedLayout;
