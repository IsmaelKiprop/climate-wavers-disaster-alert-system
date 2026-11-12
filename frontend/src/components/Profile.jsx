import { useState, useEffect } from "react";
import { BsBriefcase } from "react-icons/bs";
import { FiMapPin } from "react-icons/fi";
import { IoCreateOutline, IoCamera, IoCallOutline, IoGlobeOutline, IoLeaf, IoShareOutline, IoQrCodeOutline, IoChatbubbleEllipsesOutline, IoLogoWhatsapp } from "react-icons/io5";
import TreeBadge from "./TreeBadge";
import { toast } from "react-toastify";
import Feed from "./Feed";
import ProfileEditModal from "./ProfileEditModal";
import { useParams, useNavigate } from "react-router-dom";
import { useProfile } from "../hooks/useProfile";
import { useTrending } from "../hooks/useTrending";
import { endpoints } from "../utils/endpoints";
import { client } from "../api";
import {
  getUser,
  mergeUserMedia,
  normalizeUser,
  secureMediaUrl,
  setUser,
  withCachedMedia,
} from "../utils/factory";
import { useFollow } from "../context/FollowContext";
import ProfileShareModal from "./ProfileShareModal";
import BuyMeATreeQrModal from "./BuyMeATreeQrModal";
import ImageLightbox from "./ImageLightbox";
import {
  getProfileCompleteness,
  giftTreesPath,
} from "../utils/profileCompleteness";
import ClimateVerifiedBadge from "./ClimateVerifiedBadge";

const seedOwnProfile = (userId) => {
  const me = withCachedMedia(normalizeUser(getUser())) || {};
  if (!userId || String(me.id) !== String(userId)) return {};
  if (me.full_name && !me.first_name) {
    const parts = String(me.full_name).trim().split(/\s+/);
    return { ...me, first_name: parts[0] || "", last_name: parts.slice(1).join(" ") };
  }
  return me;
};

const Profile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const me = normalizeUser(getUser()) || {};
  const [profile, setProfile] = useState(() => seedOwnProfile(userId));
  const [feed, setFeed] = useState({});
  const [isFollowLocal, setIsFollowLocal] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showGiftQrModal, setShowGiftQrModal] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const { isFollowing, setFollowing } = useFollow();
  const isFollow = isFollowing(profile?.id || userId, isFollowLocal);
  const completeness = getProfileCompleteness(profile);

  const {
    error,
    isFetched,
    data: user,
    user: loadedUser,
  } = useProfile({
    user_id: userId,
  });

  const { data: trendingData, isLoading: trendingLoading, error: trendingError } = useTrending();

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
    const seed = seedOwnProfile(userId);
    if (seed?.id) {
      setProfile((prev) => mergeUserMedia(seed, prev?.id ? prev : seed));
    }
    const syncCookie = () => {
      const nextSeed = seedOwnProfile(userId);
      if (!nextSeed?.id) return;
      setProfile((prev) => mergeUserMedia(nextSeed, prev || {}));
    };
    window.addEventListener("userUpdated", syncCookie);
    return () => window.removeEventListener("userUpdated", syncCookie);
  }, [userId]);

  useEffect(() => {
    const nextUser = normalizeUser(user?.user || loadedUser);
    if (nextUser?.id) {
      setProfile((prev) => mergeUserMedia(prev || {}, nextUser));
      const following = Boolean(nextUser.is_following);
      setIsFollowLocal(following);
      setFollowing(nextUser.id, following);
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
  }, [isFetched, error, user, loadedUser, setFollowing]);

  const isOwnProfile = String(me.id || "") === String(profile?.id || userId || "");
  const avatarSrc = secureMediaUrl(
    profile?.profile_picture || profile?.profile_pic || profile?.picture || ""
  );
  const coverSrc = secureMediaUrl(profile?.cover || profile?.cover_image || "");
  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.full_name ||
    profile?.username ||
    "";

  const whatsappVerified = Boolean(profile?.whatsapp_verified);
  const whatsappPhone = profile?.whatsapp_phone || (whatsappVerified ? profile?.phone : "") || "";
  const whatsappDigits = String(whatsappPhone).replace(/\D/g, "");
  const whatsappHref = whatsappDigits ? `https://wa.me/${whatsappDigits}` : "";

  // Avoid flashing default plastic cover / teal avatar before cached or API media arrives.
  const mediaSettled = Boolean(isFetched || avatarSrc || coverSrc || !isOwnProfile);
  const coverPreviewSrc = coverSrc || (mediaSettled ? "/environment.jpg" : "");
  const showAvatarSkeleton = !avatarSrc && !mediaSettled;

  const handleProfilePictureClick = (event) => {
    event.stopPropagation();
    if (avatarSrc) {
      setLightbox({ src: avatarSrc, alt: `${displayName || "Profile"} photo` });
      return;
    }
    if (isOwnProfile) navigate("/uploadphoto");
  };

  const handleCoverPhotoClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!coverPreviewSrc) {
      if (isOwnProfile) navigate("/uploadcover");
      return;
    }
    setLightbox({
      src: coverPreviewSrc,
      alt: `${displayName || "Profile"} cover`,
    });
  };

  useEffect(() => {
    [avatarSrc, coverSrc].filter(Boolean).forEach((src) => {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    });
  }, [avatarSrc, coverSrc]);

  const handleProfileUpdate = (updatedUser) => {
    const nextProfile = mergeUserMedia(profile || {}, updatedUser || {});
    setProfile(nextProfile);
    setUser(nextProfile);
  };

  const follow = async (targetId) => {
    setIsFollowLocal(true);
    setFollowing(targetId, true);
    try {
      await client.run("post", endpoints?.follow, { following_id: Number(targetId) }, true);
      setIsFollowLocal(true);
      setFollowing(targetId, true);
    } catch (error) {
      const detail = String(error?.response?.data?.detail || "").toLowerCase();
      if (detail.includes("already following")) {
        setIsFollowLocal(true);
        setFollowing(targetId, true);
        return;
      }
      setIsFollowLocal(false);
      setFollowing(targetId, false);
      throw error;
    }
  };

  const unfollow = async (targetId) => {
    setIsFollowLocal(false);
    setFollowing(targetId, false);
    try {
      await client.run("delete", `${endpoints?.follow}${targetId}/`, {}, true);
      setIsFollowLocal(false);
      setFollowing(targetId, false);
    } catch (error) {
      setIsFollowLocal(true);
      setFollowing(targetId, true);
      throw error;
    }
  };

  const handleFollow = async (targetId) => {
    if (!isFollow) {
      await follow(targetId);
    } else {
      await unfollow(targetId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modern Profile Header */}
      <div className="relative">
        {/* Cover Image Section */}
        <div className="relative h-64 md:h-80 lg:h-96 overflow-hidden">
          <div
            className={`w-full h-full bg-cover bg-center bg-surface-muted cursor-zoom-in ${
              !coverPreviewSrc ? "animate-pulse" : ""
            }`}
            style={{
              backgroundImage: coverPreviewSrc ? `url(${coverPreviewSrc})` : "none",
            }}
            onClick={handleCoverPhotoClick}
            role="button"
            tabIndex={0}
            aria-label="View cover photo"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleCoverPhotoClick(e);
              }
            }}
          >
            <div className="absolute inset-0 bg-black bg-opacity-20"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
          </div>

          {isOwnProfile ? (
            <button
              type="button"
              className="absolute top-3 right-3 z-10 h-10 px-3 bg-black/55 text-white text-sm inline-flex items-center gap-2 hover:bg-black/70"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/uploadcover");
              }}
              aria-label="Change cover photo"
            >
              <IoCamera size={18} />
              <span className="hidden sm:inline">Edit cover</span>
            </button>
          ) : null}
          
          {/* Profile Picture */}
          <div className="absolute -bottom-2 md:-bottom-4 left-4 md:left-8">
            <div className="relative group">
              {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      className="w-24 h-24 md:w-32 md:h-32 lg:w-36 lg:h-36 object-cover border-4 border-white shadow-2xl cursor-zoom-in bg-surface"
                      alt={`${displayName || "Profile"} photo`}
                      style={{ borderRadius: "50%" }}
                      fetchPriority="high"
                      decoding="async"
                      onClick={handleProfilePictureClick}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "/avatar.png";
                      }}
                    />
                  ) : showAvatarSkeleton ? (
                    <div
                      className="w-24 h-24 md:w-32 md:h-32 lg:w-36 lg:h-36 border-4 border-white shadow-2xl bg-surface-muted animate-pulse"
                      style={{ borderRadius: "50%" }}
                      aria-hidden
                    />
                  ) : (
                    <div
                      className="w-24 h-24 md:w-32 md:h-32 lg:w-36 lg:h-36 border-4 border-white shadow-2xl cursor-pointer bg-primary text-primary-foreground flex items-center justify-center"
                      style={{ borderRadius: "50%" }}
                      onClick={handleProfilePictureClick}
                      role="button"
                      tabIndex={0}
                      aria-label={isOwnProfile ? "Upload profile photo" : "Profile photo"}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleProfilePictureClick(e);
                        }
                      }}
                    >
                      <span className="text-2xl md:text-3xl lg:text-4xl font-bold">
                        {displayName.charAt(0)?.toUpperCase() || ""}
                      </span>
                    </div>
                  )}
              {isOwnProfile ? (
                <button
                  type="button"
                  className="absolute top-1 right-1 z-10 h-8 w-8 rounded-full bg-black/70 text-white inline-flex items-center justify-center hover:bg-black/85 opacity-90 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/uploadphoto");
                  }}
                  aria-label="Change profile photo"
                >
                  <IoCamera size={16} />
                </button>
              ) : null}
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
        <div className="bg-surface border-t border-border -mt-1 md:-mt-2 lg:-mt-3 relative z-[1]">
          <div className="px-4 md:px-6 lg:px-8 pt-12 md:pt-14 pb-6">
            <div className="flex flex-col gap-5 max-w-3xl">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight inline-flex items-center gap-2 flex-wrap">
                  <span>{displayName || "Profile"}</span>
                  {profile?.is_verified ? (
                    <ClimateVerifiedBadge size="lg" showLabel />
                  ) : null}
                </h1>
                {profile?.username ? (
                  <p className="mt-1 text-sm text-muted">@{profile.username}</p>
                ) : null}
                {String(profile?.username || "").toLowerCase() === "waverx" ||
                String(profile?.first_name || "").toLowerCase() === "waverx" ? (
                  <p className="mt-2 text-sm text-primary font-medium">
                    Official Climate Wavers assistant · verified alerts & climate tips
                  </p>
                ) : null}
                {profile?.bio ? (
                  <p className="mt-3 text-sm md:text-base text-foreground leading-relaxed max-w-2xl">
                    {profile.bio}
                  </p>
                ) : null}
              </div>

              {isOwnProfile ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    {completeness.isComplete ? (
                      <button
                        type="button"
                        onClick={() => setShowGiftQrModal(true)}
                        className="h-11 px-4 bg-primary text-primary-foreground text-sm font-medium inline-flex items-center justify-center gap-2"
                      >
                        <IoQrCodeOutline size={18} />
                        Buy me a tree
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setIsEditModalOpen(true)}
                      className="h-11 px-4 border border-border bg-surface text-foreground text-sm font-medium inline-flex items-center justify-center gap-2"
                    >
                      <IoCreateOutline size={18} />
                      Edit profile
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <button
                      type="button"
                      onClick={() => navigate("/app/my-certificates")}
                      className="text-muted hover:text-foreground inline-flex items-center gap-1.5"
                    >
                      <IoLeaf size={16} />
                      Certificates
                    </button>
                    {completeness.isComplete ? (
                      <button
                        type="button"
                        onClick={() => setShowShareModal(true)}
                        className="text-muted hover:text-foreground inline-flex items-center gap-1.5"
                      >
                        <IoShareOutline size={16} />
                        Share profile
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : profile?.id ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        String(profile?.username || "").toLowerCase() === "waverx"
                          ? "/app/waverx"
                          : `/app/chat?dm=${profile.id}`
                      )
                    }
                    className="h-11 px-4 bg-primary text-primary-foreground text-sm font-medium inline-flex items-center justify-center gap-2"
                  >
                    <IoChatbubbleEllipsesOutline size={18} />
                    {String(profile?.username || "").toLowerCase() === "waverx"
                      ? "Chat with WaverX"
                      : "Message"}
                  </button>
                  {whatsappHref ? (
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-11 px-4 border border-[#25D366]/40 bg-[#25D366]/10 text-[#128C7E] text-sm font-medium inline-flex items-center justify-center gap-2"
                      aria-label={`WhatsApp ${displayName || "user"}`}
                    >
                      <IoLogoWhatsapp size={18} />
                      WhatsApp
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        giftTreesPath(
                          profile.id,
                          displayName || profile.username || ""
                        )
                      )
                    }
                    className="h-11 px-4 border border-border bg-surface text-foreground text-sm font-medium inline-flex items-center justify-center gap-2"
                  >
                    <IoLeaf size={18} />
                    Gift a tree
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFollow(profile?.id)}
                    className={`h-11 px-4 text-sm font-medium inline-flex items-center justify-center gap-2 border ${
                      isFollow
                        ? "border-border bg-surface text-foreground"
                        : "border-transparent bg-foreground text-background"
                    }`}
                  >
                    {isFollow ? "Following" : "Follow"}
                  </button>
                </div>
              ) : null}

              {isOwnProfile && !completeness.isComplete ? (
                <div className="border border-border bg-background p-4">
                  <p className="font-medium text-foreground">
                    Finish your profile to unlock sharing
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {completeness.completed}/{completeness.total} complete — add a photo, bio, and location to share and receive tree gifts.
                  </p>
                  <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    {completeness.checks.map((item) => (
                      <li
                        key={item.key}
                        className={item.done ? "text-primary" : "text-muted"}
                      >
                        {item.done ? "✓" : "○"} {item.label}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(true)}
                    className="mt-3 h-10 px-4 bg-primary text-primary-foreground text-sm"
                  >
                    Complete profile
                  </button>
                </div>
              ) : null}

              {(profile?.country ||
                profile?.state ||
                profile?.location ||
                profile?.profession ||
                profile?.phone ||
                whatsappHref ||
                profile?.website) && (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 border-t border-border pt-5 text-sm">
                  {(profile?.location || profile?.state || profile?.country) && (
                    <div className="flex gap-3 min-w-0">
                      <FiMapPin className="mt-0.5 shrink-0 text-muted" size={16} />
                      <div className="min-w-0">
                        <dt className="text-muted">Location</dt>
                        <dd className="text-foreground font-medium truncate">
                          {[profile.location, profile.state, profile.country]
                            .filter(Boolean)
                            .join(", ")}
                        </dd>
                      </div>
                    </div>
                  )}
                  {profile?.profession ? (
                    <div className="flex gap-3 min-w-0">
                      <BsBriefcase className="mt-0.5 shrink-0 text-muted" size={16} />
                      <div className="min-w-0">
                        <dt className="text-muted">Profession</dt>
                        <dd className="text-foreground font-medium truncate">
                          {profile.profession}
                        </dd>
                      </div>
                    </div>
                  ) : null}
                  {profile?.phone ? (
                    <div className="flex gap-3 min-w-0">
                      <IoCallOutline className="mt-0.5 shrink-0 text-muted" size={16} />
                      <div className="min-w-0">
                        <dt className="text-muted">Phone</dt>
                        <dd className="text-foreground font-medium truncate">
                          {profile.phone}
                        </dd>
                      </div>
                    </div>
                  ) : null}
                  {whatsappHref ? (
                    <div className="flex gap-3 min-w-0">
                      <IoLogoWhatsapp className="mt-0.5 shrink-0 text-[#25D366]" size={16} />
                      <div className="min-w-0">
                        <dt className="text-muted inline-flex items-center gap-1.5">
                          WhatsApp
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#128C7E] border border-[#25D366]/50 px-1.5 py-0.5">
                            Verified
                          </span>
                        </dt>
                        <dd>
                          <a
                            href={whatsappHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#128C7E] font-medium hover:underline truncate inline-block max-w-full"
                          >
                            {whatsappPhone || "Message on WhatsApp"}
                          </a>
                        </dd>
                      </div>
                    </div>
                  ) : null}
                  {profile?.website ? (
                    <div className="flex gap-3 min-w-0">
                      <IoGlobeOutline className="mt-0.5 shrink-0 text-muted" size={16} />
                      <div className="min-w-0">
                        <dt className="text-muted">Website</dt>
                        <dd>
                          <a
                            href={profile.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary font-medium break-all"
                          >
                            Visit website
                          </a>
                        </dd>
                      </div>
                    </div>
                  ) : null}
                </dl>
              )}
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

      {showShareModal ? (
        <ProfileShareModal
          user={profile}
          treesTotal={0}
          onClose={() => setShowShareModal(false)}
          onOpenGiftQr={() => {
            setShowShareModal(false);
            setShowGiftQrModal(true);
          }}
        />
      ) : null}

      {showGiftQrModal ? (
        <BuyMeATreeQrModal
          user={profile}
          onClose={() => setShowGiftQrModal(false)}
        />
      ) : null}

      {lightbox?.src ? (
        <ImageLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </div>
  );
};

export default Profile;
