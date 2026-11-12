import { NavLink, useLocation } from "react-router-dom";
import {
  IoHomeOutline,
  IoHome,
  IoPeopleOutline,
  IoPeople,
  IoLeafOutline,
  IoSparklesOutline,
  IoChatbubblesOutline,
  IoChatbubbles,
} from "react-icons/io5";
import { RiAlarmWarningLine, RiAlarmWarningFill } from "react-icons/ri";

const itemClass =
  "flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-full pt-1.5 pb-1 text-[10px] leading-tight font-medium";

const Footer = () => {
  const onboarding = useLocation().pathname.startsWith("/onboarding");
  const items = onboarding
    ? [
        { to: "/onboarding/home", label: "Home", Icon: IoHomeOutline, ActiveIcon: IoHome, end: true },
        { to: "/onboarding/community", label: "Community", Icon: IoPeopleOutline, ActiveIcon: IoPeople },
        { to: "/onboarding/plant-tree", label: "Trees", Icon: IoLeafOutline, ActiveIcon: IoLeafOutline },
        { to: "/onboarding/bot", label: "WaverX", Icon: IoSparklesOutline, ActiveIcon: IoSparklesOutline },
        { to: "/onboarding/disasters", label: "Alerts", Icon: RiAlarmWarningLine, ActiveIcon: RiAlarmWarningFill },
      ]
    : [
        { to: "/app", label: "Home", Icon: IoHomeOutline, ActiveIcon: IoHome, end: true },
        { to: "/app/community", label: "Community", Icon: IoPeopleOutline, ActiveIcon: IoPeople },
        { to: "/app/chat", label: "Chats", Icon: IoChatbubblesOutline, ActiveIcon: IoChatbubbles },
        { to: "/app/waverx", label: "WaverX", Icon: IoSparklesOutline, ActiveIcon: IoSparklesOutline },
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
        <NavLink key={to} to={to} end={Boolean(end)} className={itemClass}>
          {({ isActive }) => {
            const Glyph = isActive ? ActiveIcon : Icon;
            return (
              <>
                <Glyph size={20} className={isActive ? "text-primary" : "text-foreground/70"} aria-hidden="true" />
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
