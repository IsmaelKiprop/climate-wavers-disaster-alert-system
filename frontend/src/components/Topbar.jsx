import { useState, useRef, useEffect } from "react";
import Mobilemenu from "./Mobilemenu";
import Search from "./Search";
import { getUser, logout } from "../utils/factory";
import Modal from "../components/Modal";
import Report from "./Report";
import { NavLink } from "react-router-dom";
import { IoNotifications, IoNotificationsOutline, IoSearch } from "react-icons/io5";
import TreeBadge from './TreeBadge';
import { MdOutlineAddAlarm } from "react-icons/md";
import { IoLogOutOutline, IoPersonOutline } from "react-icons/io5";
import { useNotifications } from "../context/NotificationContext";

const Topbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { hasNewNotification, markAsRead } = useNotifications();
  const userMenuRef = useRef(null);
  const [user, setUser] = useState(getUser());

  useEffect(() => {
    const handleUserUpdate = () => setUser(getUser());
    window.addEventListener("userUpdated", handleUserUpdate);
    return () => window.removeEventListener("userUpdated", handleUserUpdate);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative z-50 bg-navbar flex items-center justify-between h-16 px-3 sm:px-4 w-full gap-2">
      <button type="button" onClick={() => setIsOpen(true)} className="md:hidden shrink-0" aria-label="Open menu">
        <img
          src={user?.profile_picture || "/avatar.png"}
          className="rounded-full h-9 w-9 object-cover"
          alt=""
          onError={(e) => {
            e.target.src = "/avatar.png";
          }}
        />
      </button>

      {isOpen ? <Mobilemenu setIsOpen={setIsOpen} /> : null}

      <div className="hidden md:flex items-center">
        <img alt="Climate Wavers" src="/logo.jpg" className="h-9 w-auto" />
      </div>

      <div className="flex-1 max-w-xl mx-1 sm:mx-4">
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
          className="hidden md:inline-flex items-center px-3 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-dark"
          onClick={() => setIsModalOpen(true)}
        >
          Report
        </button>

        {isModalOpen && (
          <Modal closeFn={() => setIsModalOpen(false)}>
            <Report closeModal={() => setIsModalOpen(false)} />
          </Modal>
        )}

        <NavLink to="/app/notifications" onClick={markAsRead} className="relative p-2" aria-label="Notifications">
          {({ isActive }) => (
            <>
              {isActive ? (
                <IoNotifications size={22} color="#067d83" />
              ) : (
                <IoNotificationsOutline size={22} />
              )}
              {hasNewNotification && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
              )}
            </>
          )}
        </NavLink>

        <button type="button" className="md:hidden p-2" aria-label="Report disaster" onClick={() => setIsModalOpen(true)}>
          <MdOutlineAddAlarm size={22} />
        </button>

        <div className="relative hidden md:block" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="rounded-full h-9 w-9 overflow-hidden"
            aria-label="Account menu"
          >
            <img
              src={user?.profile_picture || "/avatar.png"}
              className="w-full h-full object-cover"
              alt=""
              onError={(e) => {
                e.target.src = "/avatar.png";
              }}
            />
            <TreeBadge
              hasPlantedTrees={true}
              treesCount={0}
              size="small"
              userId={user?.id}
              className="absolute -bottom-1 -right-1"
            />
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 top-12 bg-surface border border-border py-2 z-50 min-w-[200px] shadow-md">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-medium">{user?.first_name} {user?.last_name}</p>
                <p className="text-xs text-muted">{user?.email}</p>
              </div>
              <NavLink
                to={`/app/${user?.id}/profile`}
                className="flex items-center px-4 py-3 text-sm hover:bg-background"
                onClick={() => setIsUserMenuOpen(false)}
              >
                <IoPersonOutline className="w-4 h-4 mr-3" />
                Profile
              </NavLink>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Log out of Climate Wavers?")) logout();
                  setIsUserMenuOpen(false);
                }}
                className="w-full flex items-center px-4 py-3 text-sm text-left text-destructive hover:bg-background"
              >
                <IoLogOutOutline className="w-4 h-4 mr-3" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>

      <Search isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
};

export default Topbar;
