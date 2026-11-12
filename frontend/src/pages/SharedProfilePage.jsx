import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FaTree } from "react-icons/fa";
import { FiMapPin } from "react-icons/fi";
import SEO from "../components/SEO";
import BuyMeATreeQrModal from "../components/BuyMeATreeQrModal";
import ImageLightbox from "../components/ImageLightbox";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { getAuthToken, getUser, secureMediaUrl } from "../utils/factory";
import { giftTreesPath, profileAppUrl } from "../utils/profileCompleteness";

const SharedProfilePage = () => {
  const { userId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showGiftQr, setShowGiftQr] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const me = getUser();
  const isOwnPublicProfile = String(me?.id || "") === String(userId || "");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await client.run(
          "get",
          `${endpoints.users}${userId}/public/`,
          {},
          false
        );
        if (!alive) return;
        setProfile(data);
        if (searchParams.get("gift") === "1") {
          navigate(giftTreesPath(userId, data?.display_name), { replace: false });
        }
      } catch (err) {
        if (!alive) return;
        const detail = err?.response?.data?.detail;
        setError(detail || "This profile is unavailable.");
        setProfile(err?.response?.data || null);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [userId, searchParams, navigate]);

  const displayName = profile?.display_name || "Climate Wavers member";
  const photo = secureMediaUrl(profile?.profile_picture, "/avatar.png");
  const cover = secureMediaUrl(profile?.cover, "/environment.jpg");
  const trees = profile?.trees?.trees_total || 0;
  const seoDescription = useMemo(() => {
    if (profile?.bio) return profile.bio;
    return `${displayName} on Climate Wavers. ${trees} trees planted. Gift a tree to support their climate impact.`;
  }, [profile?.bio, displayName, trees]);

  const giftHref = giftTreesPath(userId, displayName);
  const inAppProfile = `/app/${userId}/profile`;
  const loggedIn = Boolean(getAuthToken());

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {profile?.share_enabled ? (
        <SEO
          title={`${displayName} (@${profile.username})`}
          description={seoDescription}
          image={photo}
          url={profileAppUrl(userId)}
          type="profile"
        />
      ) : null}

      <header className="border-b border-border bg-navbar">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-tight">
            Climate Wavers
          </Link>
          <div className="flex items-center gap-2">
            {loggedIn ? (
              <Link to="/app" className="text-sm px-3 py-2 border border-border">
                Open app
              </Link>
            ) : (
              <Link to="/login" className="text-sm px-3 py-2 border border-border">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <p className="text-sm text-muted">Loading profile…</p>
        ) : error ? (
          <div className="border border-border bg-surface p-6">
            <h1 className="text-xl font-semibold">{profile?.display_name || "Profile"}</h1>
            <p className="mt-2 text-sm text-muted">{error}</p>
            <Link to="/" className="inline-block mt-4 text-sm text-primary">
              Back to Climate Wavers
            </Link>
          </div>
        ) : !profile?.share_enabled ? (
          <div className="border border-border bg-surface p-6">
            <h1 className="text-xl font-semibold">{displayName}</h1>
            <p className="mt-2 text-sm text-muted">
              This profile is still being set up, so the public share page is not available yet.
              You can still gift trees.
            </p>
            <Link
              to={giftHref}
              className="inline-flex mt-4 h-11 px-4 items-center bg-primary text-primary-foreground text-sm"
            >
              Gift trees
            </Link>
          </div>
        ) : (
          <article className="border border-border bg-surface overflow-hidden">
            <div
              className="h-44 md:h-56 bg-cover bg-center cursor-zoom-in"
              style={{ backgroundImage: `url(${cover})` }}
              onClick={() =>
                setLightbox({ src: cover, alt: `${displayName} cover` })
              }
              role="button"
              tabIndex={0}
              aria-label="View cover photo"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setLightbox({ src: cover, alt: `${displayName} cover` });
                }
              }}
            />
            <div className="px-5 md:px-8 pb-8 -mt-10">
              <img
                src={photo}
                alt={`${displayName} photo`}
                className="h-24 w-24 md:h-28 md:w-28 object-cover border-4 border-surface bg-surface cursor-zoom-in"
                style={{ borderRadius: "50%" }}
                onClick={() =>
                  setLightbox({ src: photo, alt: `${displayName} photo` })
                }
                onError={(e) => {
                  e.target.src = "/avatar.png";
                }}
              />

              <div className="mt-4 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-semibold">{displayName}</h1>
                  <p className="text-muted">@{profile?.username}</p>
                  {profile?.bio ? (
                    <p className="mt-3 max-w-2xl text-sm md:text-base leading-relaxed">
                      {profile.bio}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {loggedIn && String(me?.id) !== String(userId) ? (
                    <Link
                      to={`/app/chat?dm=${userId}`}
                      className="h-11 px-4 bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2"
                    >
                      Message
                    </Link>
                  ) : null}
                  <Link
                    to={giftHref}
                    className={`h-11 px-4 text-sm font-medium inline-flex items-center gap-2 ${
                      loggedIn && String(me?.id) !== String(userId)
                        ? "border border-border bg-surface text-foreground"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    <FaTree /> Gift trees
                  </Link>
                  {isOwnPublicProfile ? (
                    <button
                      type="button"
                      onClick={() => setShowGiftQr(true)}
                      className="h-11 px-4 border border-border text-sm font-medium"
                    >
                      Buy me a tree QR
                    </button>
                  ) : null}
                  {loggedIn && String(me?.id) !== String(userId) ? (
                    <Link
                      to={inAppProfile}
                      className="h-11 px-4 border border-border text-sm inline-flex items-center"
                    >
                      Follow in app
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="border border-border p-3">
                  <p className="text-xs text-muted">Trees</p>
                  <p className="text-xl font-semibold">{trees}</p>
                </div>
                <div className="border border-border p-3">
                  <p className="text-xs text-muted">Gifted to them</p>
                  <p className="text-xl font-semibold">
                    {profile?.trees?.trees_gifted_to_them || 0}
                  </p>
                </div>
                <div className="border border-border p-3">
                  <p className="text-xs text-muted">Followers</p>
                  <p className="text-xl font-semibold">{profile?.followers_count || 0}</p>
                </div>
                <div className="border border-border p-3">
                  <p className="text-xs text-muted">Following</p>
                  <p className="text-xl font-semibold">{profile?.following_count || 0}</p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                {(profile?.location || profile?.country || profile?.state) && (
                  <div className="border border-border p-3 flex items-start gap-3">
                    <FiMapPin className="mt-1 text-primary" />
                    <div>
                      <p className="text-xs text-muted">Location</p>
                      <p className="font-medium">
                        {[profile.location, profile.state, profile.country]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                  </div>
                )}
                {profile?.profession ? (
                  <div className="border border-border p-3">
                    <p className="text-xs text-muted">Profession</p>
                    <p className="font-medium">{profile.profession}</p>
                  </div>
                ) : null}
                {profile?.website ? (
                  <div className="border border-border p-3">
                    <p className="text-xs text-muted">Website</p>
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary break-all"
                    >
                      {profile.website}
                    </a>
                  </div>
                ) : null}
              </div>

              <p className="mt-8 text-sm text-muted">
                Anyone with this link can gift trees to {displayName}. Sign in optional for
                payment.
              </p>
            </div>
          </article>
        )}
      </main>

      {showGiftQr && profile ? (
        <BuyMeATreeQrModal user={profile} onClose={() => setShowGiftQr(false)} />
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

export default SharedProfilePage;
