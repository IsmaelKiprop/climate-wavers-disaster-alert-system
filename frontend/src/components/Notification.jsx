import { Link } from "react-router-dom";
import { MdArrowBack } from "react-icons/md";
import { useEffect } from "react";
import { useNotifications } from "../context/NotificationContext";
import { formatTimeAgo } from "../utils/apiData";
import { secureMediaUrl } from "../utils/factory";

const noticeUrl = (notice) => {
  if (notice?.content?.post) {
    return `/app/${notice.content.post}/${notice.content.id}/comments`;
  }
  if (notice?.notification_type === "follow") {
    const followerId = notice?.content?.follower?.id || notice?.actor?.id;
    return followerId ? `/app/${followerId}/profile` : "/app/notifications";
  }
  if (notice?.content?.id) {
    return `/app/${notice.content.id}/comments`;
  }
  return "/app/notifications";
};

const actorPhoto = (notice) =>
  secureMediaUrl(
    notice?.actor?.profile_picture ||
      notice?.actor?.profile_pic ||
      notice?.actor?.profile_image ||
      notice?.content?.user?.profile_picture ||
      notice?.content?.follower?.profile_picture,
    "/avatar.png"
  );

const Notification = () => {
  const { notifications, isLoading, markAsRead, refreshNotifications } = useNotifications();

  useEffect(() => {
    markAsRead();
  }, [markAsRead]);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 py-2 mb-4">
        <button type="button" onClick={() => window.history.back()} className="p-2" aria-label="Go back">
          <MdArrowBack size={22} />
        </button>
        <h1 className="text-xl font-semibold">Notifications</h1>
      </div>

      {isLoading && notifications.length === 0 ? (
        <p className="text-sm text-muted px-2">Loading notifications...</p>
      ) : null}

      {!isLoading && notifications.length === 0 ? (
        <div className="border border-border bg-surface p-6">
          <p className="font-medium">No notifications yet</p>
          <p className="mt-2 text-sm text-muted">
            Follows, comments, and disaster alerts will show up here as they happen.
          </p>
          <button
            type="button"
            className="mt-4 h-10 px-4 bg-primary text-primary-foreground text-sm"
            onClick={refreshNotifications}
          >
            Refresh
          </button>
        </div>
      ) : null}

      <ul className="divide-y divide-border border border-border bg-surface">
        {notifications.map((notice) => (
          <li key={notice.id}>
            <Link to={noticeUrl(notice)} className="flex gap-3 px-4 py-3 hover:bg-background">
              <img
                alt=""
                src={actorPhoto(notice)}
                className="h-11 w-11 shrink-0 object-cover"
                style={{ borderRadius: "50%" }}
                onError={(event) => {
                  event.target.src = "/avatar.png";
                }}
              />
              <div className="min-w-0">
                <p className="text-sm text-foreground">{notice.message}</p>
                {notice?.content?.content ? (
                  <p className="mt-1 text-sm text-muted line-clamp-2">{notice.content.content}</p>
                ) : null}
                <p className="mt-1 text-xs text-muted">{formatTimeAgo(notice.created_at)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Notification;
