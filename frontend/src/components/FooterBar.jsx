import { NavLink, useLocation } from "react-router-dom";
import {
  IoHomeOutline,
  IoHome,
  IoPeopleOutline,
  IoPeople,
  IoLeafOutline,
  IoChatbubblesOutline,
  IoChatbubbles,
} from "react-icons/io5";
import { RiAlarmWarningLine, RiAlarmWarningFill } from "react-icons/ri";
import { useChatSocket } from "../context/ChatContext";
import { prefetchHandlers } from "../utils/routePrefetch";
import WaverXIcon from "./WaverXIcon";

const itemClass =
  "flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-full pt-1.5 pb-1 text-[10px] leading-tight font-medium";

const Footer = () => {
  const onboarding = useLocation().pathname.startsWith("/onboarding");
  const { unreadTotal = 0 } = useChatSocket() || {};
  const items = onboarding
    ? [
        { to: "/onboarding/home", label: "Home", Icon: IoHomeOutline, ActiveIcon: IoHome, end: true },
        { to: "/onboarding/groups", label: "Groups", Icon: IoPeopleOutline, ActiveIcon: IoPeople },
        { to: "/onboarding/chat", label: "Chats", Icon: IoChatbubblesOutline, ActiveIcon: IoChatbubbles },
        { to: "/onboarding/plant-tree", label: "Trees", Icon: IoLeafOutline, ActiveIcon: IoLeafOutline },
        { to: "/onboarding/disasters", label: "Alerts", Icon: RiAlarmWarningLine, ActiveIcon: RiAlarmWarningFill },
      ]
    : [
        { to: "/app", label: "Home", Icon: IoHomeOutline, ActiveIcon: IoHome, end: true },
        { to: "/app/groups", label: "Groups", Icon: IoPeopleOutline, ActiveIcon: IoPeople },
        { to: "/app/chat", label: "Chats", Icon: IoChatbubblesOutline, ActiveIcon: IoChatbubbles },
        { to: "/app/waverx", label: "WaverX", Icon: WaverXIcon, ActiveIcon: WaverXIcon },
        { to: "/disasters", label: "Alerts", Icon: RiAlarmWarningLine, ActiveIcon: RiAlarmWarningFill },
      ];

  return (
    <nav
      className="relative z-40 w-full bg-navbar border-t border-border flex items-stretch px-1 pt-0.5"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        minHeight: "calc(3.5rem + env(safe-area-inset-bottom, 0px))",
      }}
      aria-label="Mobile"
    >
      {items.map(({ to, label, Icon, ActiveIcon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={Boolean(end)}
          className={itemClass}
          aria-label={
            label === "Chats" && Number(unreadTotal) > 0
              ? `Chats, ${unreadTotal > 99 ? "99+" : unreadTotal} unread`
              : label
          }
          {...prefetchHandlers(to)}
        >
          {({ isActive }) => {
            const Glyph = isActive ? ActiveIcon : Icon;
            const chatUnread =
              label === "Chats" && Number(unreadTotal) > 0
                ? Number(unreadTotal)
                : 0;
            return (
              <>
                <span className="relative inline-flex">
                  <Glyph
                    size={20}
                    className={isActive ? "text-primary" : "text-foreground/70"}
                    aria-hidden="true"
                  />
                  {chatUnread > 0 ? (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[1.05rem] h-[1.05rem] px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold leading-none flex items-center justify-center">
                      {chatUnread > 99 ? "99+" : chatUnread}
                    </span>
                  ) : null}
                </span>
                <span className={`truncate max-w-full ${isActive ? "text-primary" : "text-foreground/70"}`}>
                  {label}
                </span>
              </>
            );
          }}
        </NavLink>
      ))}
    </nav>
  );
};

export default Footer;
