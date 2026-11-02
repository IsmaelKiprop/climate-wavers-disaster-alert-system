import { NavLink } from "react-router-dom";
import { MdOutlineCampaign, MdCampaign } from "react-icons/md";
import { RiAlarmWarningFill, RiAlarmWarningLine } from "react-icons/ri";

const itemClass = "flex flex-col items-center justify-center min-w-0 flex-1 py-2 text-[10px] text-muted";

const Footer = () => {
  return (
    <nav className="fixed z-30 bg-navbar border-t border-border bottom-0 left-0 right-0 h-16 flex items-stretch px-1 pb-[env(safe-area-inset-bottom)]">
      <NavLink to="/app" end className={itemClass}>
        {({ isActive }) => (
          <>
            <img alt="" src={isActive ? "/home.png" : "/home.svg"} className="w-6 h-6 object-contain" />
            <span className={isActive ? "text-primary" : ""}>Home</span>
          </>
        )}
      </NavLink>
      <NavLink to="/app/community" className={itemClass}>
        {({ isActive }) => (
          <>
            <img alt="" src={isActive ? "/people1.png" : "/people.png"} className="w-6 h-6 object-contain" />
            <span className={isActive ? "text-primary" : ""}>Community</span>
          </>
        )}
      </NavLink>
      <NavLink to="/app/plant-tree" className={itemClass}>
        {({ isActive }) => (
          <>
            <img alt="" src={isActive ? "/tree1.svg" : "/tree.svg"} className="w-6 h-6 object-contain" />
            <span className={isActive ? "text-primary" : ""}>Trees</span>
          </>
        )}
      </NavLink>
      <NavLink to="/campaigns" className={itemClass}>
        {({ isActive }) =>
          isActive ? (
            <>
              <MdCampaign size={22} color="#067d83" />
              <span className="text-primary">Campaigns</span>
            </>
          ) : (
            <>
              <MdOutlineCampaign size={22} color="#434343" />
              <span>Campaigns</span>
            </>
          )
        }
      </NavLink>
      <NavLink to="/disasters" className={itemClass}>
        {({ isActive }) =>
          isActive ? (
            <>
              <RiAlarmWarningFill size={22} color="#EA4335" />
              <span className="text-primary">Alerts</span>
            </>
          ) : (
            <>
              <RiAlarmWarningLine size={22} color="#434343" />
              <span>Alerts</span>
            </>
          )
        }
      </NavLink>
    </nav>
  );
};

export default Footer;
