import { NavLink, useLocation } from "react-router-dom";
import {
  IoHomeOutline,
  IoHome,
  IoPeopleOutline,
  IoPeople,
  IoLeafOutline,
  IoSparklesOutline,
} from "react-icons/io5";
import { RiAlarmWarningLine, RiAlarmWarningFill } from "react-icons/ri";

const itemClass = "flex flex-col items-center justify-center min-w-0 flex-1 py-2 text-[11px]";

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
        { to: "/app/plant-tree", label: "Trees", Icon: IoLeafOutline, ActiveIcon: IoLeafOutline },
        { to: "/app/waverx", label: "WaverX", Icon: IoSparklesOutline, ActiveIcon: IoSparklesOutline },
        { to: "/disasters", label: "Alerts", Icon: RiAlarmWarningLine, ActiveIcon: RiAlarmWarningFill },
      ];

  return (
    <nav
      className="fixed z-30 bg-navbar border-t border-border bottom-0 left-0 right-0 h-16 flex items-stretch px-1 pb-[env(safe-area-inset-bottom)]"
      aria-label="Mobile"
    >
      {items.map(({ to, label, Icon, ActiveIcon, end }) => (
        <NavLink key={to} to={to} end={Boolean(end)} className={itemClass}>
          {({ isActive }) => {
            const Glyph = isActive ? ActiveIcon : Icon;
            return (
              <>
                <Glyph size={20} className={isActive ? "text-primary" : "text-muted"} aria-hidden="true" />
                <span className={isActive ? "text-primary" : "text-muted"}>{label}</span>
              </>
            );
          }}
        </NavLink>
      ))}
    </nav>
  );
};

export default Footer;
