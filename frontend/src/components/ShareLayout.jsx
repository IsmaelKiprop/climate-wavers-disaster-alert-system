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
import { prefetchRoute } from "../utils/routePrefetch";

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

  // Warm common destinations after first paint.
  useEffect(() => {
    const warm = () => {
      [
        "/app",
        "/app/chat",
        "/app/community",
        "/app/notifications",
        "/disasters",
        "/app/plant-tree",
      ].forEach(prefetchRoute);
    };
    const idleId = window.requestIdleCallback
      ? window.requestIdleCallback(warm, { timeout: 4000 })
      : window.setTimeout(warm, 2000);
    return () => {
      if (window.cancelIdleCallback && typeof idleId === "number") {
        window.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
    };
  }, []);

  return (
    <div className="bg-background text-foreground h-[100dvh] flex flex-col overflow-hidden">
      <header className="app-shell-navbar shrink-0 z-50 border-b border-border">
        <Topbar />
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        <DashboardSidebar>
          <Leftsidebar />
        </DashboardSidebar>

        <main className="app-shell-main relative z-0 flex-1 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain">
          <div className={isChat ? "h-full px-4 sm:px-6 py-4 pb-4" : "max-w-4xl mx-auto px-4 sm:px-6 py-5 pb-6 md:pb-8"}>
            <Outlet />
          </div>
        </main>

        {showAside ? (
          <aside className="app-shell-sidebar hidden xl:block relative z-10 w-[280px] border-l border-border h-full overflow-y-auto shrink-0">
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
