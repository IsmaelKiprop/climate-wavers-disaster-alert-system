import { NavLink, useLocation } from "react-router-dom";
import { prefetchHandlers } from "../../utils/routePrefetch";
import {
  IoHomeOutline,
  IoHome,
  IoPeopleOutline,
  IoPeople,
  IoPersonOutline,
  IoPerson,
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
  IoCalendarOutline,
  IoCalendar,
  IoFlagOutline,
  IoFlag,
  IoTrophyOutline,
  IoMapOutline,
  IoCheckmarkDoneOutline,
} from "react-icons/io5";
import { MdOutlineCampaign, MdCampaign } from "react-icons/md";
import { RiAlarmWarningLine, RiAlarmWarningFill } from "react-icons/ri";
import {
  getUser,
  logout,
  isAdmin,
  isPlatformStaff,
  setTreeAdminAccess,
} from "../../utils/factory";
import { MdOutlineAdminPanelSettings } from "react-icons/md";
import { useEffect, useState } from "react";
import Modal from "../Modal";
import Createpost from "../Createpost";
import Report from "../Report";
import { useNotifications } from "../../context/NotificationContext";
import { useChatSocket } from "../../context/ChatContext";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";
import WaverXIcon from "../WaverXIcon";

const AppNav = ({ onNavigate, compact = false }) => {
  const location = useLocation();
  const onboarding = location.pathname.startsWith("/onboarding");
  const isCompact = compact;
  const { hasNewNotification } = useNotifications() || {};
  const { unreadTotal = 0 } = useChatSocket() || {};
  const [user, setUser] = useState(getUser());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [treeAdminOk, setTreeAdminOk] = useState(isAdmin());
  const [hasChampionDesk, setHasChampionDesk] = useState(false);
  const [recyclerScanOk, setRecyclerScanOk] = useState(false);

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
      setHasChampionDesk(false);
      setRecyclerScanOk(false);
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
    (async () => {
      try {
        const data = await client.run(
          "get",
          endpoints.championsMe,
          {},
          true,
          false,
          false,
          false
        );
        if (cancelled) return;
        // Pending applicants need the desk for training/quizzes — not only active
        setHasChampionDesk(Boolean(data?.champion?.id || data?.champion?.status));
      } catch {
        if (!cancelled) setHasChampionDesk(false);
      }
    })();
    (async () => {
      try {
        const data = await client.run(
          "get",
          endpoints.plasticRecyclerMe,
          {},
          true,
          false,
          false,
          false
        );
        if (cancelled) return;
        setRecyclerScanOk(Boolean(data?.is_recycler));
      } catch {
        if (!cancelled) setRecyclerScanOk(false);
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
        { to: "/onboarding/calendar", label: "Calendar", Icon: IoCalendarOutline, ActiveIcon: IoCalendar },
        { to: "/onboarding/profile", label: "Profile", Icon: IoPersonOutline, ActiveIcon: IoPerson },
        { to: "/onboarding/waverx", label: "WaverX", Icon: WaverXIcon, ActiveIcon: WaverXIcon },
        { to: "/onboarding/plant-tree", label: "Plant Trees", Icon: IoLeafOutline, ActiveIcon: IoLeafOutline },
        { to: "/onboarding/collect-plastic", label: "Collect plastic", Icon: IoLeafOutline, ActiveIcon: IoLeafOutline },
        { to: "/tree-admins/apply", label: "Tree Admin", Icon: IoSettingsOutline, ActiveIcon: IoSettingsOutline },
        { to: "/onboarding/plastic-pulse", label: "Plastic Pulse", Icon: IoSettingsOutline, ActiveIcon: IoSettingsOutline },
        { to: "/onboarding/bag-scanner", label: "Bag scanner", Icon: IoLeafOutline, ActiveIcon: IoLeafOutline },
        { to: "/onboarding/notifications", label: "Notifications", Icon: IoNotificationsOutline, ActiveIcon: IoNotifications },
        { to: "/onboarding/alert-settings", label: "Alert settings", Icon: IoPhonePortraitOutline, ActiveIcon: IoPhonePortraitOutline },
        { to: "/onboarding/responder", label: "Responder Desk", Icon: IoShieldOutline, ActiveIcon: IoShieldCheckmark },
        { to: "/onboarding/champions", label: "Champions", Icon: IoFlagOutline, ActiveIcon: IoFlag },
        { to: "/onboarding/campaigns", label: "Campaigns", Icon: MdOutlineCampaign, ActiveIcon: MdCampaign },
        { to: "/onboarding/disasters", label: "Alerts", Icon: RiAlarmWarningLine, ActiveIcon: RiAlarmWarningFill },
      ]
    : [
        { to: "/app", label: "Home", Icon: IoHomeOutline, ActiveIcon: IoHome, end: true },
        { to: "/app/network", label: "Network", Icon: IoPeopleOutline, ActiveIcon: IoPeople },
        { to: "/app/groups", label: "Groups", Icon: IoPeopleCircleOutline, ActiveIcon: IoPeopleCircle },
        { to: "/app/community", label: "Community", Icon: RiAlarmWarningLine, ActiveIcon: RiAlarmWarningFill },
        {
          to: "/app/leaderboards",
          label: "Leaderboards",
          Icon: IoTrophyOutline,
          ActiveIcon: IoTrophyOutline,
        },
        {
          to: "/impact-map",
          label: "Impact map",
          Icon: IoMapOutline,
          ActiveIcon: IoMapOutline,
        },
        {
          to: "/app/corroborate",
          label: "Corroborate",
          Icon: IoCheckmarkDoneOutline,
          ActiveIcon: IoCheckmarkDoneOutline,
        },
        {
          to: "/app/chat",
          label: "Chats",
          Icon: IoChatbubblesOutline,
          ActiveIcon: IoChatbubbles,
        },
        {
          to: "/app/calendar",
          label: "Calendar",
          Icon: IoCalendarOutline,
          ActiveIcon: IoCalendar,
        },
        {
          to: user?.id ? `/app/${user.id}/profile` : "/login",
          label: "Profile",
          Icon: IoPersonOutline,
          ActiveIcon: IoPerson,
        },
        { to: "/app/waverx", label: "WaverX", Icon: WaverXIcon, ActiveIcon: WaverXIcon },
        { to: "/app/plant-tree", label: "Plant Trees", Icon: IoLeafOutline, ActiveIcon: IoLeafOutline },
        {
          to: "/app/plastic/collect",
          label: "Collect plastic",
          Icon: IoLeafOutline,
          ActiveIcon: IoLeafOutline,
        },
        ...(isPlatformStaff()
          ? [
              {
                to: "/app/platform-admin",
                label: "Platform Admin",
                Icon: MdOutlineAdminPanelSettings,
                ActiveIcon: MdOutlineAdminPanelSettings,
              },
            ]
          : []),
        ...(treeAdminOk || isAdmin()
          ? [
              {
                to: "/app/admin/tree-projects",
                label: "Tree Admin",
                Icon: IoSettingsOutline,
                ActiveIcon: IoSettingsOutline,
              },
              {
                to: "/app/admin/plastic",
                label: "Plastic Pulse",
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
        ...(recyclerScanOk
          ? [
              {
                to: "/plastic/desk",
                label: "Recycler desk",
                Icon: IoLeafOutline,
                ActiveIcon: IoLeafOutline,
              },
              {
                to: "/plastic/intake",
                label: "Bag scanner",
                Icon: IoLeafOutline,
                ActiveIcon: IoLeafOutline,
              },
            ]
          : []),
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
        {
          to: hasChampionDesk ? "/app/champions" : "/champions/apply",
          label: hasChampionDesk ? "Champion Desk" : "Become a Community Champion",
          Icon: IoFlagOutline,
          ActiveIcon: IoFlag,
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
            aria-label={
              label === "Chats" && Number(unreadTotal) > 0
                ? `Chats, ${unreadTotal > 99 ? "99+" : unreadTotal} unread`
                : label
            }
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
              const chatUnread =
                label === "Chats" && Number(unreadTotal) > 0
                  ? Number(unreadTotal)
                  : 0;
              const unreadLabel = chatUnread > 99 ? "99+" : String(chatUnread);
              return (
                <>
                  <span className="relative inline-flex">
                    <Glyph size={18} aria-hidden="true" />
                    {showDot ? (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-destructive" />
                    ) : null}
                    {isCompact && chatUnread > 0 ? (
                      <span className="absolute -top-1.5 -right-2 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold leading-none flex items-center justify-center">
                        {unreadLabel}
                      </span>
                    ) : null}
                  </span>
                  {isCompact ? (
                    <span className="sr-only">
                      {label}
                      {chatUnread > 0 ? `, ${unreadLabel} unread` : ""}
                    </span>
                  ) : (
                    <span className="flex items-center justify-between gap-2 min-w-0 flex-1">
                      <span className="truncate">{label}</span>
                      {chatUnread > 0 ? (
                        <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
                          {unreadLabel}
                        </span>
                      ) : null}
                    </span>
                  )}
                </>
              );
            }}
          </NavLink>
        ))}
      </nav>

      <div className={`flex flex-col gap-2 ${isCompact ? "items-stretch" : ""}`}>
        <button
          type="button"
          title="Report disaster"
          aria-label="Report disaster"
          className={`min-h-11 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-dark ${
            isCompact ? "px-0 flex items-center justify-center" : "w-full py-2.5"
          }`}
          onClick={() => setIsReportOpen(true)}
        >
          {isCompact ? (
            <RiAlarmWarningLine size={18} aria-hidden="true" />
          ) : (
            "Report disaster"
          )}
        </button>
        {!onboarding ? (
          <button
            type="button"
            title="New post"
            aria-label="New post"
            className={`min-h-11 text-sm font-medium border border-border text-foreground hover:bg-background ${
              isCompact ? "px-0 flex items-center justify-center" : "w-full py-2.5"
            }`}
            onClick={() => setIsModalOpen(true)}
          >
            {isCompact ? <IoCreateOutline size={18} /> : "New post"}
          </button>
        ) : null}
      </div>

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

      {isReportOpen ? (
        <Modal title="Report disaster" closeFn={() => setIsReportOpen(false)}>
          <Report />
        </Modal>
      ) : null}

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
