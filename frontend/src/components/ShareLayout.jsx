import { useEffect } from "react";
import Topbar from "./Topbar";
import Leftsidebar from "./Leftsidebar";
import Rightsidebar from "./Rightsidebar";
import DashboardSidebar from "./DashboardSidebar";
import OnlinePeopleMobile from "./OnlinePeopleMobile";
import { Outlet, useLocation } from "react-router-dom";
import Footer from "./FooterBar";
import { usePresenceHeartbeat } from "../hooks/usePresenceHeartbeat";
import {
  avatarUrl,
  completeAuthSession,
  getAuthToken,
  getUser,
} from "../utils/factory";

const SharedLayout = ({ showRight = true }) => {
  const location = useLocation();
  const isChat =
    location.pathname.startsWith("/app/waverx") ||
    location.pathname.startsWith("/app/chat");
  const showAside = showRight && !isChat;
  usePresenceHeartbeat(Boolean(getAuthToken()));

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    const user = getUser();
    if (user && avatarUrl(user) !== "/avatar.png" && user.first_name) return;
    completeAuthSession({ access_token: token, ...(user || {}) });
  }, []);

  return (
    <div className="bg-background text-foreground h-[100dvh] flex flex-col overflow-hidden">
      <header className="shrink-0 z-50 bg-navbar border-b border-border">
        <Topbar />
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <DashboardSidebar>
          <Leftsidebar />
        </DashboardSidebar>

        <main className="flex-1 min-w-0 overflow-y-auto overscroll-contain">
          <div className={isChat ? "h-full px-4 sm:px-6 py-4 pb-4" : "max-w-4xl mx-auto px-4 sm:px-6 py-5 pb-6 md:pb-8"}>
            <Outlet />
          </div>
        </main>

        {showAside ? (
          <aside className="hidden xl:block w-[280px] bg-sidebar border-l border-border h-full overflow-y-auto shrink-0">
            <Rightsidebar />
          </aside>
        ) : null}
      </div>

      {showAside ? <OnlinePeopleMobile /> : null}

      <div className="md:hidden shrink-0">
        <Footer />
      </div>
    </div>
  );
};

export default SharedLayout;
