import { useState, useRef, useEffect } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import Mobilemenu from "./Mobilemenu";
import Search from "./Search";
import BrandLogo from "./BrandLogo";
import { getUser, logout, normalizeUser } from "../utils/factory";
import Modal from "../components/Modal";
import Report from "./Report";
import UserAvatar from "./UserAvatar";
import { IoNotifications, IoNotificationsOutline, IoSearch, IoLogOutOutline, IoPersonOutline, IoMenu, IoChevronBack, IoChevronForward, IoSunnyOutline, IoMoonOutline } from "react-icons/io5";
import { useNotifications } from "../context/NotificationContext";
import { useSidebar } from "../context/SidebarContext";
import { useTheme } from "../context/ThemeContext";

const Topbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const onboarding = location.pathname.startsWith("/onboarding");
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { hasNewNotification, markAsRead } = useNotifications();
  const { collapsed, toggle } = useSidebar();
  const { isDark, preference, setPreference, toggle: toggleTheme } = useTheme();
  const userMenuRef = useRef(null);
  const [user, setUser] = useState(() => normalizeUser(getUser()) || null);
  const homeTo = onboarding ? "/onboarding/home" : "/app";
  const notificationsTo = onboarding ? "/onboarding/notifications" : "/app/notifications";
  const profileTo = user?.id
    ? onboarding
      ? "/onboarding/profile"
      : `/app/${user.id}/profile`
    : "/login";
  const showSidebarToggle =
    location.pathname.startsWith("/app") ||
    location.pathname.startsWith("/onboarding") ||
    location.pathname.startsWith("/campaigns") ||
    location.pathname.startsWith("/disasters");

  useEffect(() => {
    const handleUserUpdate = () => setUser(normalizeUser(getUser()) || null);
    window.addEventListener("userUpdated", handleUserUpdate);
    return () => window.removeEventListener("userUpdated", handleUserUpdate);
  }, []);

  useEffect(() => {
    if (!isUserMenuOpen) return undefined;
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };
    // Defer so the avatar click that opened the menu doesn't immediately close it.
    const timer = window.setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const goToProfile = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setIsUserMenuOpen(false);
    const latest = normalizeUser(getUser()) || user;
    const nextPath = latest?.id
      ? onboarding
        ? "/onboarding/profile"
        : `/app/${latest.id}/profile`
      : "/login";
    if (location.pathname === nextPath) {
      document
        .querySelector(".app-shell-main")
        ?.scrollTo?.({ top: 0, behavior: "smooth" });
      return;
    }
    navigate(nextPath);
  };

  return (
    <div className="relative z-50 bg-navbar flex items-center justify-between h-16 px-3 sm:px-5 w-full gap-2 isolate">
      <div className="flex items-center gap-2 shrink-0">
        <button type="button" onClick={() => setIsOpen(true)} className="md:hidden p-2" aria-label="Open menu">
          <IoMenu size={22} />
        </button>
        {showSidebarToggle ? (
          <button
            type="button"
            onClick={toggle}
            className="hidden md:inline-flex p-2 hover:bg-background text-foreground"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <IoChevronForward size={18} /> : <IoChevronBack size={18} />}
          </button>
        ) : null}
        {isOpen ? <Mobilemenu setIsOpen={setIsOpen} /> : null}
        <Link to={homeTo} className="hidden md:flex items-center gap-2 text-foreground">
          <BrandLogo imgClassName="h-8 w-auto" />
          <span className="hidden lg:inline text-sm font-semibold">Climate Wavers</span>
        </Link>
      </div>

      <div className="flex-1 max-w-xl">
        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          className="w-full h-10 px-3 bg-background border border-border flex items-center gap-2 text-left text-muted text-sm"
        >
          <IoSearch size={16} />
          <span className="truncate">Search posts, people, hashtags</span>
        </button>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 text-foreground hover:bg-background"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Light mode" : "Dark mode"}
        >
          {isDark ? <IoSunnyOutline size={20} /> : <IoMoonOutline size={20} />}
        </button>

        <button
          type="button"
          className="hidden md:inline-flex items-center px-3 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-dark"
          onClick={() => setIsModalOpen(true)}
        >
          Report disaster
        </button>

        {isModalOpen ? (
          <Modal title="Report disaster" closeFn={() => setIsModalOpen(false)}>
            <Report />
          </Modal>
        ) : null}

        <NavLink to={notificationsTo} onClick={markAsRead} className="relative p-2" aria-label="Notifications">
          {({ isActive }) => (
            <>
              {isActive ? (
                <IoNotifications size={20} className="text-primary" />
              ) : (
                <IoNotificationsOutline size={20} />
              )}
              {hasNewNotification ? (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive" />
              ) : null}
            </>
          )}
        </NavLink>

        <button type="button" className="md:hidden p-2 text-sm font-medium text-primary" aria-label="Report disaster" onClick={() => setIsModalOpen(true)}>
          Report
        </button>

        <div className="relative hidden md:block" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="h-9 w-9 overflow-hidden"
            aria-label="Account menu"
          >
            <UserAvatar
              user={user}
              className="w-full h-full"
              textClassName="text-sm"
              alt=""
            />
          </button>

          {isUserMenuOpen ? (
            <div className="absolute right-0 top-12 bg-surface border border-border py-2 z-[200] min-w-[220px] shadow-md">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-medium">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-muted truncate">{user?.email}</p>
              </div>
              <a
                href={profileTo}
                className="flex items-center px-4 py-2.5 text-sm hover:bg-background"
                onClick={goToProfile}
              >
                <IoPersonOutline className="w-4 h-4 mr-3" />
                Profile
              </a>
              <div className="px-4 py-2.5 border-y border-border">
                <p className="text-xs text-muted mb-2">Appearance</p>
                <div className="flex gap-1">
                  {[
                    { id: "light", label: "Light" },
                    { id: "dark", label: "Dark" },
                    { id: "system", label: "System" },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setPreference(option.id)}
                      className={`flex-1 min-h-8 px-2 text-xs font-medium border ${
                        preference === option.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-surface text-foreground hover:border-primary"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Log out of Climate Wavers?")) logout();
                  setIsUserMenuOpen(false);
                }}
                className="w-full flex items-center px-4 py-2.5 text-sm text-left text-destructive hover:bg-background"
              >
                <IoLogOutOutline className="w-4 h-4 mr-3" />
                Log out
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <Search isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
};

export default Topbar;
