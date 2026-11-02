import Topbar from "./Topbar";
import Leftsidebar from "./Leftsidebar";
import Rightsidebar from "./Rightsidebar";
import { Outlet } from "react-router-dom";
import Footer from "./FooterBar";

const SharedLayout = ({ showRight = true }) => {
  return (
    <div className="bg-background text-foreground min-h-[100dvh] flex flex-col">
      <header className="sticky top-0 z-50 bg-navbar border-b border-border">
        <Topbar />
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:block w-[220px] lg:w-[248px] bg-sidebar border-r border-border sticky top-16 h-[calc(100dvh-4rem)] overflow-y-auto shrink-0">
          <Leftsidebar />
        </aside>

        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 pb-24 md:pb-8">
            <Outlet />
          </div>
        </main>

        {showRight ? (
          <aside className="hidden xl:block w-[260px] bg-sidebar border-l border-border sticky top-16 h-[calc(100dvh-4rem)] overflow-y-auto shrink-0">
            <Rightsidebar />
          </aside>
        ) : null}
      </div>

      <div className="md:hidden">
        <Footer />
      </div>
    </div>
  );
};

export default SharedLayout;
