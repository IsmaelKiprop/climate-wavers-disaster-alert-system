import { NavLink } from "react-router-dom";
import Modal from "./Modal";
import Createpost from "./Createpost";
import { getUser, logout, isAdmin } from "../utils/factory";
import { MdOutlineCampaign, MdCampaign } from "react-icons/md";
import { RiAlarmWarningFill, RiAlarmWarningLine } from "react-icons/ri";
import { IoLogOutOutline, IoLogOut, IoNotifications, IoNotificationsOutline } from "react-icons/io5";
import { useState, useEffect } from "react";

const Menu = ({ setIsOpen }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [user, setUser] = useState(getUser());

  useEffect(() => {
    setUser(getUser());
    
        // Listen for localStorage changes
        const handleStorageChange = () => {
          const updatedUser = getUser();
          setUser(updatedUser);
        };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events (for same-tab updates)
    window.addEventListener('userUpdated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userUpdated', handleStorageChange);
    };
  }, []);

  const getNavLinkClassName = (isActive) => 
    `flex items-center py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-gray-100 cursor-pointer ${
      isActive ? 'bg-[#067d83] text-white' : 'text-gray-700 hover:text-[#067d83]'
    }`;

  return (
    <div className="flex flex-col w-full h-full">
      {/* Logo */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-[#067d83] leading-tight mb-2">Climate Wavers</h1>
        <p className="text-sm text-gray-600 font-medium">Climate Action Platform</p>
      </div>
      
      {/* Menu */}
      <div className="flex flex-col space-y-1">
        <NavLink
          to={"/app"}
          className={({ isActive }) => getNavLinkClassName(isActive)}
          end
        >
          {({ isActive }) => (
            <>
              <img
                alt="home"
                src={isActive ? "../../home.png" : "../../home.svg"}
                className="mr-3 w-5 h-5"
              />
              Home
            </>
          )}
        </NavLink>
        <NavLink
          to={"/app/community"}
          className={({ isActive }) => getNavLinkClassName(isActive)}
          end
        >
          {({ isActive }) => (
            <>
              <img
                src={isActive ? "../../people1.png" : "../../people.png"}
                className="mr-3 w-5 h-5"
              />
              Community
            </>
          )}
        </NavLink>

        <NavLink
          to={user?.id ? `/app/${user.id}/profile` : "/login"}
          className={({ isActive }) => getNavLinkClassName(isActive)}
          end
        >
          {({ isActive }) => (
            <>
              <img
                src={isActive ? "../../profile1.png" : "../../profile.png"}
                className="mr-3 w-5 h-5"
              />
              Profile
            </>
          )}
        </NavLink>
        <NavLink
          to={`/app/plant-tree`}
          className={({ isActive }) => getNavLinkClassName(isActive)}
          end
        >
          {({ isActive }) => (
            <>
              <img
                src={isActive ? "../../tree1.svg" : "../../tree.svg"}
                className="mr-3 w-5 h-5"
              />
              Plant Trees
            </>
          )}
        </NavLink>
        {isAdmin() && (
          <NavLink
            to={`/app/admin/tree-projects`}
            className={({ isActive }) => getNavLinkClassName(isActive)}
            end
          >
            {({ isActive }) => (
              <>
                <img
                  src={isActive ? "../../admin1.svg" : "../../admin.svg"}
                  className="mr-3 w-5 h-5"
                />
                Tree Admin
              </>
            )}
          </NavLink>
        )}
        <NavLink
          to={"/campaigns"}
          className={({ isActive }) => getNavLinkClassName(isActive)}
        >
          {({ isActive }) => (
            <div className="flex items-center">
              {isActive ? (
                <MdCampaign className="mr-3" size={20} color="#067d83" />
              ) : (
                <MdOutlineCampaign className="mr-3" size={20} color="#434343" />
              )}
              <p className="ml-1">Campaigns</p>
            </div>
          )}
        </NavLink>
        <NavLink
          to={`/disasters`}
          className={({ isActive }) => getNavLinkClassName(isActive)}
        >
          {({ isActive }) => (
            <div className="flex items-center">
              {isActive ? (
                <RiAlarmWarningFill
                  className="mr-3"
                  size={20}
                  color="#EA4335"
                />
              ) : (
                <RiAlarmWarningLine
                  className="mr-3"
                  size={20}
                  color="#434343"
                />
              )}
              <p className="self-center pl-2"> Disasters </p>
            </div>
          )}
        </NavLink>
        <NavLink
          to={"/app/notifications"}
          className={({ isActive }) => getNavLinkClassName(isActive)}
          end
        >
          {({ isActive }) => (
            <>
              {isActive ? (
                <IoNotifications className="mr-3 w-5 h-5" color="#067d83" />
              ) : (
                <IoNotificationsOutline className="mr-3 w-5 h-5" color="#434343" />
              )}
              Notifications
            </>
          )}
        </NavLink>
        <NavLink
          to={`/app/waverx`}
          className={({ isActive }) => getNavLinkClassName(isActive)}
        >
          <img src="../../waverbot.png" className="mr-4 w-auto" />
          WaverX AI
        </NavLink>
      </div>
      
      {/* Post btn */}
      <button
        // to={"./createpost"}
        className="text-center font-semibold bg-primary text-primary-foreground self-center w-[80%] py-3 mb-4"
        onClick={() => {
          setIsModalOpen(true);
        }}
      >
        Post
      </button>
      
      {/* Logout Section - Moved to bottom for better visibility */}
      <div className="mt-auto pt-4 border-t border-gray-200">
        <button
          onClick={() => {
            if (window.confirm('Are you sure you want to logout?')) {
              logout();
            }
          }}
          className="flex items-center py-3 px-4 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-red-50 text-red-600 hover:text-red-700 cursor-pointer w-full border border-red-200 hover:border-red-300"
        >
          <IoLogOutOutline className="mr-3" size={20} />
          <span className="font-semibold">Logout</span>
        </button>
      </div>
      {isModalOpen && (
        <Modal closeFn={() => setIsModalOpen(false)}>
          <Createpost
            type={"post"}
            closeModal={() => {
              setIsModalOpen(false);
              setIsOpen(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
};

export default Menu;
