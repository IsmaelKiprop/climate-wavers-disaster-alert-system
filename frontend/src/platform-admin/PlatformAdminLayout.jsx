import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { IoClose, IoMenuOutline, IoArrowBackOutline } from "react-icons/io5";
import { toast } from "react-toastify";
import BrandLogo from "../components/BrandLogo";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { getUser, isPlatformStaff } from "../utils/factory";
import { PLATFORM_ADMIN_NAV } from "./nav";

const PlatformAdminLayout = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [counts, setCounts] = useState({});
  const [drawer, setDrawer] = useState(false);
  const user = getUser();

  const refreshCounts = useCallback(async () => {
    try {
      const data = await client.run("get", endpoints.platformAdminMe, {}, true);
      setCounts(data?.counts || {});
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!isPlatformStaff()) {
      setDenied(true);
      setReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await client.run("get", endpoints.platformAdminMe, {}, true);
        if (cancelled) return;
        if (!data?.is_platform_admin) {
          setDenied(true);
        } else {
          setCounts(data.counts || {});
          setDenied(false);
        }
      } catch {
        if (!cancelled) {
          setDenied(true);
          toast.error("Platform Admin access required");
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <p className="text-sm text-muted">Checking staff access…</p>
      </div>
    );
  }

  if (denied) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center border border-border bg-surface p-6">
          <h1 className="text-xl font-semibold">Staff only</h1>
          <p className="text-sm text-muted mt-2">
            Platform Admin is limited to Climate Wavers staff accounts.
          </p>
          <button
            type="button"
            onClick={() => navigate("/app")}
            className="mt-5 h-10 px-4 bg-primary text-primary-foreground text-sm font-medium"
          >
            Back to app
          </button>
        </div>
      </div>
    );
  }

  const NavItems = ({ onNavigate }) => (
    <nav className="flex flex-col gap-0.5 p-3">
      {PLATFORM_ADMIN_NAV.map((item) => {
        const badge = item.badge ? counts[item.badge] : null;
        return (
          <NavLink
            key={item.id}
            to={item.to}
            end={Boolean(item.end)}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center justify-between gap-2 px-3 h-10 text-sm font-medium border ${
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-transparent text-foreground hover:border-border"
              }`
            }
          >
            <span>{item.label}</span>
            {badge > 0 ? (
              <span
                className={`min-w-5 h-5 px-1.5 text-[11px] font-semibold inline-flex items-center justify-center ${
                  "bg-background text-foreground"
                }`}
              >
                {badge > 99 ? "99+" : badge}
              </span>
            ) : null}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-surface sticky top-0 h-[100dvh]">
        <div className="p-4 border-b border-border">
          <BrandLogo imgClassName="h-9 w-auto" />
          <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-primary font-semibold">
            Platform Admin
          </p>
          <p className="text-xs text-muted mt-1 truncate">
            {user?.email || user?.username}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavItems />
        </div>
        <div className="p-3 border-t border-border">
          <Link
            to="/app"
            className="h-10 px-3 border border-border text-sm inline-flex items-center gap-2 w-full"
          >
            <IoArrowBackOutline size={16} />
            Back to app
          </Link>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-surface">
          <div className="h-14 px-3 sm:px-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                className="lg:hidden h-10 w-10 inline-flex items-center justify-center border border-border"
                onClick={() => setDrawer(true)}
                aria-label="Open menu"
              >
                <IoMenuOutline size={20} />
              </button>
              <div className="lg:hidden min-w-0">
                <p className="text-sm font-semibold truncate">Platform Admin</p>
              </div>
            </div>
            <Link
              to="/app"
              className="lg:hidden h-9 px-3 border border-border text-xs inline-flex items-center"
            >
              App
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet context={{ counts, refreshCounts }} />
        </main>
      </div>

      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close menu"
            onClick={() => setDrawer(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[min(100%,18rem)] bg-surface border-r border-border flex flex-col">
            <div className="h-14 px-3 flex items-center justify-between border-b border-border">
              <p className="text-sm font-semibold">Menu</p>
              <button
                type="button"
                className="h-10 w-10 inline-flex items-center justify-center border border-border"
                onClick={() => setDrawer(false)}
                aria-label="Close"
              >
                <IoClose size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavItems onNavigate={() => setDrawer(false)} />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
};

export default PlatformAdminLayout;
