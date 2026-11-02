import { NavLink, useLocation } from "react-router-dom";
import {
  IoHomeOutline,
  IoHome,
  IoPeopleOutline,
  IoPeople,
  IoPersonOutline,
  IoPerson,
  IoSparklesOutline,
  IoLeafOutline,
  IoSettingsOutline,
  IoNotificationsOutline,
  IoNotifications,
  IoLogOutOutline,
} from "react-icons/io5";
import { MdOutlineCampaign, MdCampaign } from "react-icons/md";
import { RiAlarmWarningLine, RiAlarmWarningFill } from "react-icons/ri";
import { getUser, logout, isAdmin } from "../../utils/factory";
import { useEffect, useState } from "react";
import Modal from "../Modal";
import Createpost from "../Createpost";

const itemClass = ({ isActive }) =>
  `flex items-center gap-3 px-3 py-2.5 text-sm font-medium ${
    isActive
      ? "bg-primary text-primary-foreground"
      : "text-foreground hover:bg-background"
  }`;

const AppNav = ({ onNavigate, compact = false }) => {
  const location = useLocation();
  const onboarding = location.pathname.startsWith("/onboarding");
  const [user, setUser] = useState(getUser());
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const sync = () => setUser(getUser());
    window.addEventListener("userUpdated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("userUpdated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const close = () => onNavigate?.();

  const items = onboarding
    ? [
        { to: "/onboarding/home", label: "Home", Icon: IoHomeOutline, ActiveIcon: IoHome, end: true },
        { to: "/onboarding/community", label: "Community", Icon: IoPeopleOutline, ActiveIcon: IoPeople },
        { to: "/onboarding/profile", label: "Profile", Icon: IoPersonOutline, ActiveIcon: IoPerson },
        { to: "/onboarding/bot", label: "WaverX", Icon: IoSparklesOutline, ActiveIcon: IoSparklesOutline },
        { to: "/onboarding/plant-tree", label: "Plant Trees", Icon: IoLeafOutline, ActiveIcon: IoLeafOutline },
        { to: "/onboarding/tree-admin", label: "Tree Admin", Icon: IoSettingsOutline, ActiveIcon: IoSettingsOutline },
        { to: "/onboarding/notifications", label: "Notifications", Icon: IoNotificationsOutline, ActiveIcon: IoNotifications },
        { to: "/onboarding/campaigns", label: "Campaigns", Icon: MdOutlineCampaign, ActiveIcon: MdCampaign },
        { to: "/onboarding/disasters", label: "Alerts", Icon: RiAlarmWarningLine, ActiveIcon: RiAlarmWarningFill },
      ]
    : [
        { to: "/app", label: "Home", Icon: IoHomeOutline, ActiveIcon: IoHome, end: true },
        { to: "/app/community", label: "Community", Icon: IoPeopleOutline, ActiveIcon: IoPeople },
        {
          to: user?.id ? `/app/${user.id}/profile` : "/login",
          label: "Profile",
          Icon: IoPersonOutline,
          ActiveIcon: IoPerson,
        },
        { to: "/app/waverx", label: "WaverX", Icon: IoSparklesOutline, ActiveIcon: IoSparklesOutline },
        { to: "/app/plant-tree", label: "Plant Trees", Icon: IoLeafOutline, ActiveIcon: IoLeafOutline },
        ...(isAdmin()
          ? [
              {
                to: "/app/admin/tree-projects",
                label: "Tree Admin",
                Icon: IoSettingsOutline,
                ActiveIcon: IoSettingsOutline,
              },
            ]
          : []),
        { to: "/app/notifications", label: "Notifications", Icon: IoNotificationsOutline, ActiveIcon: IoNotifications },
        { to: "/campaigns", label: "Campaigns", Icon: MdOutlineCampaign, ActiveIcon: MdCampaign },
        { to: "/disasters", label: "Alerts", Icon: RiAlarmWarningLine, ActiveIcon: RiAlarmWarningFill },
      ];

  return (
    <div className="flex flex-col h-full">
      <nav className="flex flex-col gap-1" aria-label="Main">
        {items.map(({ to, label, Icon, ActiveIcon, end }) => (
          <NavLink key={to} to={to} end={Boolean(end)} className={itemClass} onClick={close}>
            {({ isActive }) => {
              const Glyph = isActive ? ActiveIcon : Icon;
              return (
                <>
                  <Glyph size={18} aria-hidden="true" />
                  <span>{label}</span>
                </>
              );
            }}
          </NavLink>
        ))}
      </nav>

      {!onboarding && !compact ? (
        <button
          type="button"
          className="mt-6 w-full py-2.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-dark"
          onClick={() => setIsModalOpen(true)}
        >
          New post
        </button>
      ) : null}

      <div className="mt-auto pt-6 border-t border-border">
        {user?.first_name ? (
          <p className="px-3 mb-3 text-xs text-muted truncate">
            {user.first_name} {user.last_name}
          </p>
        ) : null}
        <button
          type="button"
          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-destructive hover:bg-background"
          onClick={() => {
            if (window.confirm("Log out of Climate Wavers?")) logout();
          }}
        >
          <IoLogOutOutline size={18} aria-hidden="true" />
          Log out
        </button>
      </div>

      {isModalOpen ? (
        <Modal closeFn={() => setIsModalOpen(false)}>
          <Createpost
            type="post"
            closeModal={() => {
              setIsModalOpen(false);
              close();
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
};

export default AppNav;
