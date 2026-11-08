import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { endpoints } from "../utils/endpoints";
import { client } from "../api";
import { Link } from "react-router-dom";
import { avatarUrl, getUser } from "../utils/factory";

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

const Accountcard = ({ user, onFollowChange }) => {
  const [isFollow, setIsFollow] = useState(user?.is_following);
  const me = getUser();

  // Sync follow status when user prop changes
  useEffect(() => {
    setIsFollow(user?.is_following);
  }, [user?.is_following]);

  const follow = async (userId) => {
    try {
      await client.run(
        "post",
        endpoints?.follow,
        { following_id: Number(userId) },
        true
      );
      setIsFollow(true);
      if (onFollowChange) onFollowChange(userId, true);
    } catch (error) {
      console.log("Follow error:", error.response?.data);
      if (alreadyFollowing(error)) {
        setIsFollow(true);
        if (onFollowChange) onFollowChange(userId, true);
        return;
      }
      setIsFollow(false);
      throw error;
    }
  };

  const unfollow = async (userId) => {
    try {
      await client.run("delete", `${endpoints?.follow}${userId}/`, {}, true);
      setIsFollow(false);
      // Notify parent component of follow change
      if (onFollowChange) {
        onFollowChange(userId, false);
      }
    } catch (error) {
      // Revert UI state on error
      setIsFollow(true);
      throw error;
    }
  };
  
  const handleFollow = async (userId) => {
    if (isFollow) {
      await unfollow(userId);
    } else {
      await follow(userId);
    }
  };

  return (
    <div className="flex items-center justify-between">
      <Link to={`/app/${user?.id}/profile`} className="flex-1 min-w-0 group">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="relative">
            <img
              src={avatarUrl(user)}
              className="h-12 w-12 rounded-full object-cover ring-2 ring-gray-100 group-hover:ring-teal-200 transition-all duration-200 flex-shrink-0"
              alt="Profile Pic"
              onError={(e) => {
                e.target.src = "/avatar.png";
              }}
            />
            <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-400 border-2 border-white rounded-full"></div>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 truncate group-hover:text-teal-600 transition-colors duration-200">
              {user?.first_name} {user?.last_name}
            </h3>
            <p className="text-sm text-gray-500 truncate">@{user?.username}</p>
          </div>
        </div>
      </Link>
      {me.id !== user?.id && (
        <button
          onClick={() => {
            handleFollow(user?.id);
          }}
          className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 flex-shrink-0 ${
            isFollow
              ? "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
              : "bg-teal-500 text-white hover:bg-teal-600 shadow-sm hover:shadow-md"
          }`}
        >
          {isFollow ? "Following" : "Follow"}
        </button>
      )}
    </div>
  );
};

Accountcard.propTypes = {
  user: PropTypes.object,
  onFollowChange: PropTypes.func,
};

export default Accountcard;
