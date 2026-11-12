import Topbar from "../Topbar";
import Leftsidebar from "./Leftsidebar";
import DashboardSidebar from "../DashboardSidebar";
import { Outlet } from "react-router-dom";
import Footer from "../FooterBar";
import { usePresenceHeartbeat } from "../../hooks/usePresenceHeartbeat";
import { getAuthToken } from "../../utils/factory";

const OnboardingLayout = () => {
  usePresenceHeartbeat(Boolean(getAuthToken()));

  return (
    <div className="bg-background text-foreground min-h-[100dvh] flex flex-col">
      <header className="app-shell-navbar sticky top-0 z-50 border-b border-border">
        <Topbar />
      </header>

      <div className="flex flex-1 min-h-0 relative">
        <DashboardSidebar>
          <Leftsidebar />
        </DashboardSidebar>

        <main className="app-shell-main relative z-0 flex-1 min-w-0 overflow-x-hidden">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 pb-6 md:pb-8">
            <Outlet />
          </div>
        </main>
      </div>

      <div className="md:hidden shrink-0">
        <Footer />
      </div>
    </div>
  );
};

export default OnboardingLayout;
