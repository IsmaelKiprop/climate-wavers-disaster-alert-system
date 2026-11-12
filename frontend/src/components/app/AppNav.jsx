import { NavLink, useLocation } from "react-router-dom";
import { prefetchHandlers } from "../../utils/routePrefetch";
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
  IoCreateOutline,
  IoPhonePortraitOutline,
  IoShieldOutline,
  IoShieldCheckmark,
  IoChatbubblesOutline,
  IoChatbubbles,
  IoPeopleCircleOutline,
  IoPeopleCircle,
} from "react-icons/io5";
import { MdOutlineCampaign, MdCampaign } from "react-icons/md";
import { RiAlarmWarningLine, RiAlarmWarningFill } from "react-icons/ri";
import { getUser, logout, isAdmin, setTreeAdminAccess } from "../../utils/factory";
import { useEffect, useState } from "react";
import Modal from "../Modal";
import Createpost from "../Createpost";
import { useNotifications } from "../../context/NotificationContext";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";

const AppNav = ({ onNavigate, compact = false }) => {
  const location = useLocation();
  const onboarding = location.pathname.startsWith("/onboarding");
  const isCompact = compact;
  const { hasNewNotification } = useNotifications() || {};
  const [user, setUser] = useState(getUser());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [treeAdminOk, setTreeAdminOk] = useState(isAdmin());

  useEffect(() => {
    const sync = () => setUser(getUser());
    window.addEventListener("userUpdated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("userUpdated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!user?.id && !user?.email) {
      setTreeAdminOk(false);
      setTreeAdminAccess(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await client.run("get", endpoints.treeAdminMe, {}, true, false, false, false);
        if (cancelled) return;
        const ok = Boolean(data?.has_tree_admin_access);
        setTreeAdminAccess(ok);
        setTreeAdminOk(ok || isAdmin());
      } catch {
        if (!cancelled) setTreeAdminOk(isAdmin());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email]);

  const close = () => onNavigate?.();

  const items = onboarding
    ? [
        { to: "/onboarding/home", label: "Home", Icon: IoHomeOutline, ActiveIcon: IoHome, end: true },
        { to: "/onboarding/network", label: "Network", Icon: IoPeopleOutline, ActiveIcon: IoPeople },
        { to: "/onboarding/groups", label: "Groups", Icon: IoPeopleCircleOutline, ActiveIcon: IoPeopleCircle },
        { to: "/onboarding/community", label: "Community", Icon: RiAlarmWarningLine, ActiveIcon: RiAlarmWarningFill },
        { to: "/onboarding/chat", label: "Chats", Icon: IoChatbubblesOutline, ActiveIcon: IoChatbubbles },
        { to: "/onboarding/profile", label: "Profile", Icon: IoPersonOutline, ActiveIcon: IoPerson },
        { to: "/onboarding/waverx", label: "WaverX", Icon: IoSparklesOutline, ActiveIcon: IoSparklesOutline },
        { to: "/onboarding/plant-tree", label: "Plant Trees", Icon: IoLeafOutline, ActiveIcon: IoLeafOutline },
        { to: "/tree-admins/apply", label: "Tree Admin", Icon: IoSettingsOutline, ActiveIcon: IoSettingsOutline },
        { to: "/onboarding/notifications", label: "Notifications", Icon: IoNotificationsOutline, ActiveIcon: IoNotifications },
        { to: "/onboarding/alert-settings", label: "Alert settings", Icon: IoPhonePortraitOutline, ActiveIcon: IoPhonePortraitOutline },
        { to: "/onboarding/responder", label: "Responder Desk", Icon: IoShieldOutline, ActiveIcon: IoShieldCheckmark },
        { to: "/onboarding/disasters", label: "Alerts", Icon: RiAlarmWarningLine, ActiveIcon: RiAlarmWarningFill },
      ]
    : [
        { to: "/app", label: "Home", Icon: IoHomeOutline, ActiveIcon: IoHome, end: true },
        { to: "/app/network", label: "Network", Icon: IoPeopleOutline, ActiveIcon: IoPeople },
        { to: "/app/groups", label: "Groups", Icon: IoPeopleCircleOutline, ActiveIcon: IoPeopleCircle },
        { to: "/app/community", label: "Community", Icon: RiAlarmWarningLine, ActiveIcon: RiAlarmWarningFill },
        {
          to: "/app/chat",
          label: "Chats",
          Icon: IoChatbubblesOutline,
          ActiveIcon: IoChatbubbles,
        },
        {
          to: user?.id ? `/app/${user.id}/profile` : "/login",
          label: "Profile",
          Icon: IoPersonOutline,
          ActiveIcon: IoPerson,
        },
        { to: "/app/waverx", label: "WaverX", Icon: IoSparklesOutline, ActiveIcon: IoSparklesOutline },
        { to: "/app/plant-tree", label: "Plant Trees", Icon: IoLeafOutline, ActiveIcon: IoLeafOutline },
        ...(treeAdminOk || isAdmin()
          ? [
              {
                to: "/app/admin/tree-projects",
                label: "Tree Admin",
                Icon: IoSettingsOutline,
                ActiveIcon: IoSettingsOutline,
              },
            ]
          : [
              {
                to: "/tree-admins/apply",
                label: "Become Tree Admin",
                Icon: IoSettingsOutline,
                ActiveIcon: IoSettingsOutline,
              },
            ]),
        { to: "/app/notifications", label: "Notifications", Icon: IoNotificationsOutline, ActiveIcon: IoNotifications },
        {
          to: "/app/alert-settings",
          label: "Alert settings",
          Icon: IoPhonePortraitOutline,
          ActiveIcon: IoPhonePortraitOutline,
        },
        {
          to: "/app/responder",
          label: "Responder Desk",
          Icon: IoShieldOutline,
          ActiveIcon: IoShieldCheckmark,
        },
        { to: "/campaigns", label: "Campaigns", Icon: MdOutlineCampaign, ActiveIcon: MdCampaign },
        { to: "/disasters", label: "Alerts", Icon: RiAlarmWarningLine, ActiveIcon: RiAlarmWarningFill },
      ];

  return (
    <div className="flex flex-col gap-3">
      <nav className="flex flex-col gap-1" aria-label="Main">
        {items.map(({ to, label, Icon, ActiveIcon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={Boolean(end)}
            title={label}
            aria-label={label}
            onClick={close}
            {...prefetchHandlers(to)}
            className={({ isActive }) =>
              `flex items-center min-h-11 text-sm font-medium ${
                isCompact ? "justify-center px-0" : "gap-3 px-3"
              } py-2.5 ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-background"
              }`
            }
          >
            {({ isActive }) => {
              const Glyph = isActive ? ActiveIcon : Icon;
              const showDot = label === "Notifications" && hasNewNotification;
              return (
                <>
                  <span className="relative inline-flex">
                    <Glyph size={18} aria-hidden="true" />
                    {showDot ? (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-destructive" />
                    ) : null}
                  </span>
                  {isCompact ? <span className="sr-only">{label}</span> : <span>{label}</span>}
                </>
              );
            }}
          </NavLink>
        ))}
      </nav>

      {!onboarding ? (
        <button
          type="button"
          title="New post"
          aria-label="New post"
          className={`min-h-11 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-dark ${
            isCompact ? "px-0 flex items-center justify-center" : "w-full py-2.5"
          }`}
          onClick={() => setIsModalOpen(true)}
        >
          {isCompact ? <IoCreateOutline size={18} /> : "New post"}
        </button>
      ) : null}

      <div className="pt-3 border-t border-border">
        {user?.first_name && !isCompact ? (
          <p className="px-3 mb-2 text-xs text-muted truncate">
            {user.first_name} {user.last_name}
          </p>
        ) : null}
        <button
          type="button"
          title="Log out"
          aria-label="Log out"
          className={`flex items-center min-h-11 w-full text-sm font-medium text-destructive hover:bg-background ${
            isCompact ? "justify-center px-0" : "gap-3 px-3 py-2.5"
          }`}
          onClick={() => {
            if (window.confirm("Log out of Climate Wavers?")) logout();
          }}
        >
          <IoLogOutOutline size={18} aria-hidden="true" />
          {isCompact ? <span className="sr-only">Log out</span> : "Log out"}
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
