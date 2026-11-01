import { useState, useEffect } from "react";
import { endpoints } from "../utils/endpoints";
import { client } from "../api";
import { getAuthToken } from "../utils/factory";
import { useNotifications } from "../context/NotificationContext";
import { Link } from "react-router-dom";
import { MdArrowBack } from "react-icons/md";
import { wsHttpUrl } from "../config/env";

const Notification = () => {
  const [notifications, setNotifications] = useState([]);
  const { receiveNewNotification } = useNotifications();

  const backendSocket = import.meta.env.VITE_WSS_BACKEND;

  const token = getAuthToken();

  const handleGoBack = () => {
    window.history.back();
  };
  useEffect(() => {
    const getNotifications = async () => {
      const url = endpoints["notifications"];
      const res = await client.run("get", url, {}, true);
      setNotifications((prev) => {
        const existingIds = new Set(
          prev.map((notification) => notification.id)
        );

        // Combine API data with existing notifications, filtering out duplicates
        const merged = res.filter(
          (notification) => !existingIds.has(notification.id)
        );

        return [...prev, ...merged]; // Return the combined notifications
      });
      console.log(res);
    };
    getNotifications();
  }, []);

  useEffect(() => {
    // Try WebSocket connection first
    const tryWebSocketConnection = async () => {
      try {
        console.log('Attempting WebSocket connection...');
        
        // Use the new WebSocket-like endpoint
        const wsUrl = wsHttpUrl(`/api/v1/ws/notifications/?token=${token}`);
        console.log('WebSocket URL:', wsUrl);
        
        const response = await fetch(wsUrl);
        const data = await response.json();
        
        if (response.ok) {
          console.log('WebSocket connection established:', data);
          // Connection successful, start polling for notifications
          return startNotificationPolling();
        } else {
          console.log('WebSocket connection failed, using polling fallback');
          return startNotificationPolling();
        }
      } catch (error) {
        console.log('WebSocket connection error, using polling fallback:', error);
        return startNotificationPolling();
      }
    };
    
    const startNotificationPolling = () => {
      console.log('Starting notification polling...');
      
      // Use polling to check for new notifications
      const pollInterval = setInterval(async () => {
        try {
          console.log('Polling for notifications...');
          const url = endpoints["notifications"];
          const res = await client.run("get", url, {}, true);
          console.log('Notifications response:', res);
          
          if (res && res.length > 0) {
            setNotifications(prev => {
              const existingIds = new Set(prev.map(n => n.id));
              const newNotifications = res.filter(n => !existingIds.has(n.id));
              if (newNotifications.length > 0) {
                console.log('New notifications found:', newNotifications);
                receiveNewNotification();
              }
              return [...prev, ...newNotifications];
            });
          } else {
            console.log('No notifications found');
          }
        } catch (error) {
          console.log('Polling for notifications failed:', error);
        }
      }, 30000); // Poll every 30 seconds
      
      return pollInterval;
    };
    
    let pollInterval = null;
    
    // Start polling immediately and also try WebSocket
    const immediatePoll = startNotificationPolling();
    
    tryWebSocketConnection().then(interval => {
      if (interval) {
        // Clear the immediate poll and use the WebSocket-based poll
        clearInterval(immediatePoll);
        pollInterval = interval;
      } else {
        pollInterval = immediatePoll;
      }
    });
    
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [receiveNewNotification, token]);

  const noticeUrl = (notice) => {
    if (notice?.content?.post) {
      return `/app/${notice.content.post}/${notice.content.id}/comments`;
    } else if (notice?.notification_type === "follow") {
      return `/app/${notice?.content?.follower?.id}/profile`;
    } else if (notice?.content?.id) {
      return `/app/${notice.content.id}/comments`;
    }
  };

  return (
    <div className="grid max-w-[100vw] overflow-x-hidden">
      <div className="flex py-12 md:px-4 md:gap-x-4 gap-x-2">
        <button onClick={handleGoBack}>
          <MdArrowBack size={35} color={"#434343"} />
        </button>
        <h2 className="text-2xl font-serif">Notifications</h2>
      </div>
      {notifications.map((notices, index) => (
        <div
          key={`${notices.id}${index}`}
          className="md:w-[100%] w-[100vw]  h-28 border-y-2  border-[#E6EAEE66] shadow-sm  "
        >
          <Link to={noticeUrl(notices)}>
            <div className="flex md:pt-4 py-4 px-8 gap-x-4">
              <img
                alt="profile pic"
                src={
                  notices.user.profile_picture
                    ? notices.user.profile_picture
                    : notices.user.profile_image || "/avatar.png"
                }
                className="w-12 h-12"
                onError={(e) => {
                  e.target.src = "/avatar.png";
                }}
              />
              <div className="flex flex-col h-full">
                <p className="text-xl text-start">{notices.message}</p>
                <p className="text-sm text-gray-500 md:h-[70%] h-[40px] max-h-[200px]  md:w-[85%] w-[50%] overflow-hidden capitalize">
                  {notices?.content?.content}
                </p>
              </div>
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
};
export default Notification;
