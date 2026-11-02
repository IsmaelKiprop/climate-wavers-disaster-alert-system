import { useState, useEffect } from "react";
import { BsBriefcase } from "react-icons/bs";
import { FiMapPin } from "react-icons/fi";
import { IoCreateOutline, IoCamera, IoCallOutline, IoGlobeOutline, IoLeaf } from "react-icons/io5";
import TreeBadge from "./TreeBadge";
import { toast } from "react-toastify";
import Feed from "./Feed";
import ProfileEditModal from "./ProfileEditModal";
import { useParams, useNavigate } from "react-router-dom";
import { useProfile } from "../hooks/useProfile";
import { useTrending } from "../hooks/useTrending";
import { endpoints } from "../utils/endpoints";
import { client } from "../api";
import { getUser, setUser } from "../utils/factory";

const seedOwnProfile = (userId) => {
  const me = getUser() || {};
  if (!userId || String(me.id) !== String(userId)) return {};
  if (me.first_name || me.profile_picture || me.username) return me;
  if (me.full_name) {
    const parts = String(me.full_name).trim().split(/\s+/);
    return { ...me, first_name: parts[0] || "", last_name: parts.slice(1).join(" ") };
  }
  return me;
};

const Profile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const me = getUser() || {};
  const [profile, setProfile] = useState(() => seedOwnProfile(userId));
  const [feed, setFeed] = useState({});
  const [isFollow, setIsFollow] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const {
    error,
    isFetched,
    data: user,
    user: loadedUser,
  } = useProfile({
    user_id: userId,
  });

  const {
    data: trendingData,
    isLoading: trendingLoading,
    error: trendingError,
  } = useTrending();

  // Debug trending data
  useEffect(() => {
    console.log("Trending data:", trendingData);
    console.log("Trending loading:", trendingLoading);
    console.log("Trending error:", trendingError);
  }, [trendingData, trendingLoading, trendingError]);

  const profileFeeds = [
    "post",
    "comments",
    "reposts",
    "bookmarks",
    "likes",
    "polls",
    "trending",
  ];

  useEffect(() => {
    const nextUser = user?.user || loadedUser;
    if (nextUser?.id) {
      setProfile((prev) => ({ ...prev, ...nextUser }));
      setIsFollow(Boolean(nextUser.is_following));
    }
    if (user) {
      setFeed({
        post: user.posts || [],
        comments: user.comments || [],
        reposts: user.repost || [],
        bookmarks: user.bookmarks || [],
        likes: user.reactions || [],
        polls: user.polls || [],
      });
    }
    if (error && !nextUser?.id) {
      toast.dismiss();
      toast.error("We could not load this profile.");
    }
  }, [isFetched, error, user, loadedUser]);

  const isOwnProfile = String(me.id || "") === String(profile?.id || userId || "");
  const avatarSrc = profile?.profile_picture || profile?.profile_pic || profile?.picture || "";
  const coverSrc = profile?.cover || profile?.cover_image || "";
  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.username || "";

  const handleProfilePictureClick = (event) => {
    event.stopPropagation();
    if (isOwnProfile) navigate("/uploadphoto");
  };

  const handleCoverPhotoClick = (e) => {
    e.preventDefault();
    if (isOwnProfile) navigate("/uploadcover");
  };

  const handleProfileUpdate = (updatedUser) => {
    const nextProfile = {
      ...profile,
      ...updatedUser,
      profile_picture:
        updatedUser?.profile_picture ||
        updatedUser?.profile_pic ||
        profile?.profile_picture,
    };
    setProfile(nextProfile);

    const currentUser = getUser() || {};
    setUser({
      ...currentUser,
      ...nextProfile,
    });
  };

  const follow = async (userId) => {
    console.log("Profile - Attempting to follow user:", userId, "Current isFollow state:", isFollow);
    try {
    await client.run("post", endpoints?.follow, { following_id: userId }, true);
      console.log("Profile - Follow successful, updating state to true");
      setIsFollow(true);
    } catch (error) {
      console.log("Profile - Follow error:", error.response?.data);
      // Handle specific follow errors
      if (error.response?.data?.detail === "You are already following this user.") {
        // User is already following, update UI to reflect this
        console.log("Profile - User already being followed, updating UI state");
        setIsFollow(true);
        return;
      }
      // Revert UI state on other errors
      console.log("Profile - Other error, reverting state to false");
      setIsFollow(false);
      throw error;
    }
  };

  const unfollow = async (userId) => {
    console.log("Profile - Attempting to unfollow user:", userId);
    try {
    await client.run("delete", `${endpoints?.follow}${userId}/`, {}, true);
      console.log("Profile - Unfollow successful, updating state to false");
      setIsFollow(false);
    } catch (error) {
      console.log("Profile - Unfollow error:", error.response?.data);
      // Revert UI state on error
      console.log("Profile - Unfollow error, reverting state to true");
      setIsFollow(true);
      throw error;
    }
  };
  
  const handleFollow = async (userId) => {
    console.log("Profile - handleFollow called - isFollow:", isFollow, "userId:", userId);
    if (!isFollow) {
      console.log("Profile - User is not being followed, calling follow");
      await follow(userId);
    } else {
      console.log("Profile - User is already being followed, calling unfollow");
      await unfollow(userId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modern Profile Header */}
      <div className="relative">
        {/* Cover Image Section */}
        <div className="relative h-64 md:h-80 lg:h-96 overflow-hidden">
          <div
            className="w-full h-full bg-cover bg-center bg-background cursor-pointer"
          style={{
            backgroundImage: `url(${coverSrc || "/environment.jpg"})`,
          }}
            onClick={(e) => handleCoverPhotoClick(e)}
          >
            <div className="absolute inset-0 bg-black bg-opacity-20"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
          </div>
          
          {/* Profile Picture */}
          <div className="absolute -bottom-2 md:-bottom-4 left-4 md:left-8">
            <div className="relative group">
              {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      className="w-24 h-24 md:w-32 md:h-32 lg:w-36 lg:h-36 object-cover border-4 border-white shadow-2xl cursor-pointer"
                      alt=""
                      style={{ borderRadius: "50%" }}
                      fetchPriority="high"
                      onClick={handleProfilePictureClick}
                      onError={(e) => {
                        e.target.src = "/avatar.png";
                      }}
                    />
                  ) : (
                    <div
                      className="w-24 h-24 md:w-32 md:h-32 lg:w-36 lg:h-36 border-4 border-white shadow-2xl cursor-pointer bg-primary text-primary-foreground flex items-center justify-center"
                      style={{ borderRadius: "50%" }}
                      onClick={handleProfilePictureClick}
                    >
                      <span className="text-2xl md:text-3xl lg:text-4xl font-bold">
                        {displayName.charAt(0)?.toUpperCase() || ""}
                      </span>
                    </div>
                  )}
              <div className="absolute inset-0 rounded-full bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300 flex items-center justify-center">
                <IoCamera className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" size={24} />
              </div>
              {/* Tree Badge */}
              <TreeBadge 
                hasPlantedTrees={true}
                treesCount={0}
                size="large"
                userId={profile?.id}
                className="absolute bottom-10 right-5 z-[9999] sm:bottom-14 sm:right-7"
          />
        </div>
      </div>
        </div>

        {/* Profile Info Section */}
        <div className="bg-white rounded-t-3xl -mt-1 md:-mt-2 lg:-mt-3 relative z-[1] shadow-xl">
          <div className="px-4 md:px-6 lg:px-8 pt-10 md:pt-14 lg:pt-18 pb-6">
            {/* User Info Header */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  {/* User Info */}
                  <div className="flex items-center gap-3">
                    <div>
                      <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-1">
                        {displayName || "Profile"}
                      </h1>
                      <p className="text-lg text-gray-500 font-medium">
                        {profile?.username ? `@${profile.username}` : ""}
                      </p>
                    </div>
                  </div>
                  
                  {/* Action Button */}
                  <div className="flex-shrink-0">
                    {isOwnProfile ? (
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => navigate("/app/my-certificates")}
                          className="bg-green-500 text-white px-6 py-3 rounded-full font-semibold text-sm hover:bg-green-600 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl"
                        >
                          <IoLeaf size={18} />
                          My Certificates
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditModalOpen(true)}
                          className="bg-teal-500 text-white px-6 py-3 rounded-full font-semibold text-sm hover:bg-teal-600 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl"
                        >
                          <IoCreateOutline size={18} />
                          Edit Profile
                        </button>
                      </div>
                    ) : profile?.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsFollow(!isFollow);
                          handleFollow(profile?.id);
                        }}
                        className={`px-6 py-3 rounded-full font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
                          isFollow
                            ? "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
                            : "bg-teal-500 text-white hover:bg-teal-600 shadow-lg hover:shadow-xl"
                        }`}
                      >
                        {isFollow ? "Following" : "Follow"}
                      </button>
                    ) : null}
      </div>
                </div>

                {/* Bio Section */}
                {profile?.bio && (
                  <div className="mt-4">
                    <p className="text-gray-700 text-base leading-relaxed max-w-2xl">
          {profile?.bio}
        </p>
                  </div>
                )}

                {/* User Details Grid */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Location */}
                  {profile?.country && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200">
                      <div className="flex-shrink-0 w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                        <FiMapPin className="text-teal-600" size={18} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Location</p>
                        <p className="text-gray-900 font-semibold">{profile?.country}</p>
                      </div>
                    </div>
                  )}

                  {/* Profession */}
                  {profile?.profession && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200">
                      <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <BsBriefcase className="text-blue-600" size={18} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Profession</p>
                        <p className="text-gray-900 font-semibold">{profile?.profession}</p>
                      </div>
                    </div>
                  )}

                  {/* State */}
                  {profile?.state && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200">
                      <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <FiMapPin className="text-purple-600" size={18} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">State</p>
                        <p className="text-gray-900 font-semibold">{profile?.state}</p>
                      </div>
                    </div>
                  )}

                  {/* Phone */}
                  {profile?.phone && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200">
                      <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <IoCallOutline className="text-green-600" size={18} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Phone</p>
                        <p className="text-gray-900 font-semibold">{profile?.phone}</p>
                      </div>
                    </div>
                  )}

                  {/* Website */}
                  {profile?.website && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200">
                      <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                        <IoGlobeOutline className="text-orange-600" size={18} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Website</p>
                        <a 
                          href={profile?.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-teal-600 hover:text-teal-700 font-semibold transition-colors duration-200"
                        >
                          Visit Website
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Location */}
                  {profile?.location && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200">
                      <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <FiMapPin className="text-indigo-600" size={18} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Address</p>
                        <p className="text-gray-900 font-semibold">{profile?.location}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Feed 
        feeds={profileFeeds} 
        feedData={feed} 
        trendingData={trendingData}
        trendingLoading={trendingLoading}
        trendingError={trendingError}
      />
      
      {/* Profile Edit Modal */}
      <ProfileEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        user={profile}
        onProfileUpdate={handleProfileUpdate}
      />
    </div>
  );
};

export default Profile;
