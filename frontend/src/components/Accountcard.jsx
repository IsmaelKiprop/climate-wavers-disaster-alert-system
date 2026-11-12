import { useState } from "react";
import PropTypes from "prop-types";
import { endpoints } from "../utils/endpoints";
import { client } from "../api";
import { Link } from "react-router-dom";
import { avatarUrl, getUser } from "../utils/factory";
import { useFollow } from "../context/FollowContext";

const alreadyFollowing = (error) => {
  const data = error?.response?.data;
  if (!data) return false;
  if (typeof data.detail === "string" && data.detail.toLowerCase().includes("already following")) {
    return true;
  }
  const nonField = data.non_field_errors;
  if (Array.isArray(nonField) && nonField.some((msg) => String(msg).toLowerCase().includes("already following"))) {
    return true;
  }
  return false;
};

const Accountcard = ({ user }) => {
  const me = getUser();
  const { isFollowing, setFollowing } = useFollow();
  const profileId = user?.id || user?.userId || user?.pk;
  const followed = isFollowing(profileId, user?.is_following);
  const [busy, setBusy] = useState(false);

  const follow = async (userId) => {
    setFollowing(userId, true);
    try {
      await client.run(
        "post",
        endpoints?.follow,
        { following_id: Number(userId) },
        true
      );
      setFollowing(userId, true);
    } catch (error) {
      if (alreadyFollowing(error)) {
        setFollowing(userId, true);
        return;
      }
      setFollowing(userId, false);
      throw error;
    }
  };

  const unfollow = async (userId) => {
    setFollowing(userId, false);
    try {
      await client.run("delete", `${endpoints?.follow}${userId}/`, {}, true);
      setFollowing(userId, false);
    } catch (error) {
      setFollowing(userId, true);
      throw error;
    }
  };

  const handleFollow = async (userId) => {
    if (busy || !userId) return;
    setBusy(true);
    try {
      if (followed) {
        await unfollow(userId);
      } else {
        await follow(userId);
      }
    } finally {
      setBusy(false);
    }
  };

  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username;
  const verified = Boolean(user?.is_verified);
  const subtitle = user?.profession || (user?.username ? `@${user.username}` : "");

  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5">
      <Link
        to={profileId ? `/app/${profileId}/profile` : "#"}
        className="flex-1 min-w-0 group"
        aria-label={displayName ? `Open ${displayName} profile` : "Open profile"}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex-shrink-0">
            <img
              src={avatarUrl(user)}
              className="h-10 w-10 rounded-full object-cover ring-2 ring-gray-100 group-hover:ring-teal-200 transition-all duration-200"
              alt={displayName || "Profile"}
              onError={(e) => {
                e.target.src = "/avatar.png";
              }}
            />
            {user?.is_online ? (
              <div
                className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-primary border-2 border-surface rounded-full"
                title="Online"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors duration-200 inline-flex items-center gap-1 max-w-full">
              <span className="truncate">{displayName}</span>
              {verified ? (
                <span
                  className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-primary"
                  title="Verified"
                >
                  ✓
                </span>
              ) : null}
            </h3>
            <p className="text-xs text-muted truncate">{subtitle}</p>
          </div>
        </div>
      </Link>
      {profileId && me?.id !== profileId && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Link
            to={
              String(user?.username || "").toLowerCase() === "waverx"
                ? "/app/waverx"
                : `/app/chat?dm=${profileId}`
            }
            className="px-2.5 py-1.5 text-xs font-medium border border-border text-foreground hover:border-primary"
            style={{ borderRadius: 5 }}
            aria-label={`Message ${displayName}`}
          >
            Message
          </Link>
          <button
            type="button"
            disabled={busy}
            aria-pressed={followed}
            onClick={() => {
              handleFollow(profileId);
            }}
            className={`px-2.5 py-1.5 text-xs font-medium transition-all duration-200 disabled:opacity-60 ${
              followed
                ? "bg-surface-muted text-foreground hover:bg-background border border-border"
                : "bg-primary text-primary-foreground hover:bg-primary-dark"
            }`}
            style={{ borderRadius: 5 }}
          >
            {busy ? "…" : followed ? "Following" : "Follow"}
          </button>
        </div>
      )}
    </div>
  );
};

Accountcard.propTypes = {
  user: PropTypes.object,
};

export default Accountcard;
