import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { IoClose } from "react-icons/io5";
import { toast } from "react-toastify";
import PublicPage from "../components/PublicPage";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import {
  avatarInitial,
  avatarUrl,
  getAuthToken,
  getUser,
  hasCustomAvatar,
} from "../utils/factory";

const ChampionAvatar = ({ champion, size = "h-14 w-14" }) => {
  const [broken, setBroken] = useState(false);
  const src = !broken
    ? avatarUrl({
        profile_picture: champion?.profile_picture,
        profile_pic: champion?.profile_pic,
        picture: champion?.picture,
      })
    : "";
  const showPhoto = Boolean(src) && hasCustomAvatar(champion) && !broken;
  const initial = avatarInitial({
    first_name: (champion?.display_name || "").split(" ")[0],
    last_name: (champion?.display_name || "").split(" ").slice(1).join(" "),
    username: champion?.display_name,
  });

  if (showPhoto) {
    return (
      <img
        src={src}
        alt=""
        className={`${size} shrink-0 object-cover border border-border bg-background`}
        style={{ borderRadius: 6 }}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div
      className={`${size} shrink-0 border border-border bg-surface text-primary inline-flex items-center justify-center text-lg font-semibold`}
      style={{ borderRadius: 6 }}
      aria-hidden
    >
      {initial || "C"}
    </div>
  );
};

const Stars = ({ value = 0, onPick, size = "text-sm" }) => (
  <div className={`inline-flex gap-0.5 ${size}`} aria-label={`${value} of 5 stars`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        disabled={!onPick}
        onClick={(e) => {
          e.stopPropagation();
          onPick?.(n);
        }}
        className={`${n <= Math.round(value) ? "text-primary" : "text-muted"} ${
          onPick ? "cursor-pointer hover:text-primary" : "cursor-default"
        }`}
        aria-label={`${n} stars`}
      >
        ★
      </button>
    ))}
  </div>
);

const enrichChampionPhoto = (champion, meUser, myChampionId) => {
  if (!champion) return champion;
  const isSelf =
    (myChampionId && champion.id === myChampionId) ||
    (meUser?.id &&
      champion.user_id != null &&
      String(champion.user_id) === String(meUser.id));
  if (!isSelf || !meUser) {
    return { ...champion, is_self: Boolean(isSelf) };
  }
  const photo =
    champion.profile_picture ||
    meUser.profile_picture ||
    meUser.profile_pic ||
    meUser.picture ||
    "";
  return {
    ...champion,
    is_self: true,
    profile_picture: photo || champion.profile_picture || "",
    profile_pic: meUser.profile_pic || champion.profile_pic || "",
    picture: meUser.picture || champion.picture || "",
    user_id: champion.user_id || meUser.id,
  };
};

const ChampionDetailModal = ({
  champion,
  detail,
  ratings,
  loading,
  isSelf,
  onClose,
  onRate,
  score,
  setScore,
  comment,
  setComment,
  submitting,
  myRating,
}) => {
  if (!champion) return null;
  const c = detail?.champion || champion;
  const impact = detail?.impact;
  const meUser = getUser();
  const profilePath = meUser?.id ? `/app/${meUser.id}/profile` : "/login";

  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-0 sm:p-6"
      style={{ background: "rgba(8,12,12,0.82)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="champion-detail-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-surface border border-border max-h-[92dvh] overflow-y-auto rounded-t-[14px] sm:rounded-[14px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-surface border-b border-border p-4 flex items-start justify-between gap-3">
          <div className="flex gap-3 min-w-0">
            <ChampionAvatar champion={c} size="h-16 w-16" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted">
                {c.tier} · impact {c.impact_score ?? impact?.impact_score ?? 0}
              </p>
              <h2
                id="champion-detail-title"
                className="text-xl font-semibold text-foreground mt-0.5 break-words"
              >
                {c.display_name}
              </h2>
              <p className="text-xs text-muted mt-1">
                {[c.affiliation, c.ward, c.city, c.region, c.country]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 shrink-0 inline-flex items-center justify-center border border-border"
            aria-label="Close"
          >
            <IoClose size={20} />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {loading ? (
            <p className="text-sm text-muted">Loading details…</p>
          ) : (
            <>
              {c.bio ? (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted">About</p>
                  <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{c.bio}</p>
                </div>
              ) : null}

              {c.languages ? (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted">Languages</p>
                  <p className="text-sm text-foreground mt-1">{c.languages}</p>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Impact score", c.impact_score ?? impact?.impact_score ?? 0],
                  [
                    "Rating",
                    `${Number(c.rating_avg ?? 0).toFixed(1)} (${c.rating_count ?? 0})`,
                  ],
                  ["Verifications", c.verifications_count ?? impact?.verifications?.total ?? 0],
                  ["Households", c.enrollments_count ?? impact?.enrollments ?? 0],
                  ["Warn blasts", c.proximity_blasts_count ?? impact?.alerts?.blasts ?? 0],
                  [
                    "Training",
                    impact?.training
                      ? `${impact.training.completed}/${impact.training.total}`
                      : c.certificate_code
                        ? "Complete"
                        : "—",
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="border border-border p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
                    <p className="text-sm font-semibold text-foreground mt-1">{value}</p>
                  </div>
                ))}
              </div>

              {c.certificate_code ? (
                <Link
                  to={`/verify/champion/${c.certificate_code}`}
                  className="inline-flex h-10 px-3 items-center border border-border text-sm font-medium"
                >
                  View certificate · {c.certificate_code}
                </Link>
              ) : null}

              {isSelf ? (
                <div className="border border-border p-3 space-y-2">
                  <p className="text-sm text-muted">This is your Champion profile.</p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to="/app/champions"
                      className="h-10 px-3 inline-flex items-center bg-primary text-primary-foreground text-sm font-semibold"
                    >
                      Open Champion Desk
                    </Link>
                    {!hasCustomAvatar(c) ? (
                      <Link
                        to={profilePath}
                        className="h-10 px-3 inline-flex items-center border border-border text-sm"
                      >
                        Add profile photo
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : (
                <form onSubmit={onRate} className="border border-border p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">Rate this champion</p>
                  <p className="text-xs text-muted">
                    How reliable and helpful are they for your community?
                    {myRating
                      ? ` You rated ${myRating.score}/5 previously — submit again to update.`
                      : ""}
                  </p>
                  <Stars value={score} onPick={setScore} size="text-2xl" />
                  <textarea
                    className="w-full border border-border p-2 text-sm bg-background"
                    rows={3}
                    maxLength={400}
                    placeholder="Optional comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-11 bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                  >
                    {submitting ? "Saving…" : myRating ? "Update rating" : "Submit rating"}
                  </button>
                  {!getAuthToken() ? (
                    <p className="text-xs text-muted">
                      <Link to="/login?redirect=/champions" className="text-primary hover:underline">
                        Sign in
                      </Link>{" "}
                      to rate.
                    </p>
                  ) : null}
                </form>
              )}

              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted mb-2">
                  Recent community ratings
                </p>
                {!ratings?.length ? (
                  <p className="text-sm text-muted">No ratings yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {ratings.slice(0, 8).map((r) => (
                      <li key={r.id} className="border border-border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <Stars value={r.score} />
                          <span className="text-[11px] text-muted truncate">
                            {r.user_name}
                          </span>
                        </div>
                        {r.comment ? (
                          <p className="text-sm text-foreground-soft mt-1">{r.comment}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

const ChampionDirectoryPage = () => {
  const [rows, setRows] = useState([]);
  const [city, setCity] = useState("");
  const [order, setOrder] = useState("impact");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [myRating, setMyRating] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [myChampionId, setMyChampionId] = useState(null);

  const load = async (cityFilter = city, orderBy = order) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cityFilter) params.set("city", cityFilter);
      if (orderBy) params.set("order", orderBy);
      const q = params.toString() ? `?${params}` : "";
      const data = await client.run(
        "get",
        `${endpoints.championsDirectory}${q}`,
        {},
        false
      );
      let myId = myChampionId;
      const meUser = getUser();
      if (getAuthToken()) {
        try {
          const mine = await client.run("get", endpoints.championsMe, {}, true);
          myId = mine?.champion?.id ?? null;
          setMyChampionId(myId);
        } catch {
          /* not a champion */
        }
      }
      const list = (data?.results || []).map((c) =>
        enrichChampionPhoto(c, meUser, myId)
      );
      setRows(list);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = async (champion) => {
    const enriched = enrichChampionPhoto(champion, getUser(), myChampionId);
    setSelected(enriched);
    setDetail(null);
    setRatings([]);
    setMyRating(null);
    setComment("");
    setScore(5);
    setDetailLoading(true);
    try {
      const [impactRes, ratingRes] = await Promise.allSettled([
        client.run("get", endpoints.championsImpact(champion.id), {}, false),
        client.run("get", endpoints.championsRatings(champion.id), {}, Boolean(getAuthToken())),
      ]);
      if (impactRes.status === "fulfilled") {
        setDetail({
          champion: enrichChampionPhoto(
            impactRes.value?.champion || champion,
            getUser(),
            myChampionId
          ),
          impact: impactRes.value?.impact || null,
        });
      } else {
        setDetail({ champion: enriched, impact: null });
      }
      if (ratingRes.status === "fulfilled") {
        setRatings(ratingRes.value?.results || []);
        setMyRating(ratingRes.value?.my_rating || null);
        if (ratingRes.value?.my_rating?.score) {
          setScore(ratingRes.value.my_rating.score);
          setComment(ratingRes.value.my_rating.comment || "");
        }
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setDetail(null);
    setRatings([]);
    setMyRating(null);
  };

  const submitRating = async (e) => {
    e.preventDefault();
    if (!selected || selected.is_self) return;
    if (!getAuthToken()) {
      toast.error("Sign in to rate a champion");
      return;
    }
    setSubmitting(true);
    try {
      const data = await client.run(
        "post",
        endpoints.championsRatings(selected.id),
        { score, comment },
        true
      );
      toast.success("Thanks — rating saved");
      setRows((list) =>
        list.map((c) =>
          c.id === selected.id
            ? {
                ...c,
                rating_avg: data.rating_avg,
                rating_count: data.rating_count,
                impact_score: data.impact_score,
              }
            : c
        )
      );
      setMyRating({ score, comment, updated_at: new Date().toISOString() });
      const ratingData = await client.run(
        "get",
        endpoints.championsRatings(selected.id),
        {},
        true
      );
      setRatings(ratingData?.results || []);
      setDetail((d) =>
        d
          ? {
              ...d,
              champion: {
                ...d.champion,
                rating_avg: data.rating_avg,
                rating_count: data.rating_count,
                impact_score: data.impact_score,
              },
            }
          : d
      );
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not save rating");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!selected) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") closeDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [selected]);

  return (
    <PublicPage>
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">
              Community Champions
            </p>
            <h1 className="text-3xl font-semibold text-foreground mt-1">
              Directory
            </h1>
            <p className="text-sm text-muted mt-2 max-w-xl">
              Tap a champion to view details and rate their reliability in your community.
            </p>
          </div>
          <Link
            to="/champions/apply"
            className="h-11 px-4 inline-flex items-center bg-primary text-primary-foreground text-sm font-semibold"
          >
            Become a Community Champion
          </Link>
        </div>

        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            load(city, order);
          }}
        >
          <input
            className="flex-1 h-10 border border-border px-3 text-sm"
            placeholder="Filter by city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <select
            className="h-10 border border-border px-3 text-sm bg-surface"
            value={order}
            onChange={(e) => {
              setOrder(e.target.value);
              load(city, e.target.value);
            }}
          >
            <option value="impact">Sort by impact</option>
            <option value="rating">Sort by rating</option>
          </select>
          <button type="submit" className="h-10 px-3 border border-border text-sm">
            Search
          </button>
        </form>

        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted">No active champions yet.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => openDetail(c)}
                  className="w-full text-left border border-border p-4 hover:border-primary transition-colors"
                >
                  <div className="flex gap-3 sm:gap-4">
                    <ChampionAvatar champion={c} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="text-lg font-semibold text-foreground">
                          {c.display_name}
                        </h2>
                        <span className="text-xs uppercase tracking-wide text-muted">
                          {c.tier} · impact {c.impact_score ?? 0}
                        </span>
                      </div>
                      <p className="text-sm text-muted mt-1">
                        {[c.affiliation, c.ward, c.city, c.country]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {c.bio ? (
                        <p className="text-sm text-foreground-soft mt-2 line-clamp-3">
                          {c.bio}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <Stars value={Number(c.rating_avg) || 0} />
                        <span className="text-xs text-muted">
                          {(Number(c.rating_avg) || 0).toFixed(1)} · {c.rating_count || 0}{" "}
                          ratings
                        </span>
                        <span className="text-xs font-medium text-primary">
                          View details
                          {!c.is_self ? " · Rate" : ""}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-2">
                        {c.verifications_count || 0} verifications ·{" "}
                        {c.enrollments_count || 0} households ·{" "}
                        {c.proximity_blasts_count || 0} warn blasts
                        {c.sponsor_name ? ` · Sponsored by ${c.sponsor_name}` : ""}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected ? (
        <ChampionDetailModal
          champion={selected}
          detail={detail}
          ratings={ratings}
          loading={detailLoading}
          isSelf={Boolean(selected.is_self)}
          onClose={closeDetail}
          onRate={submitRating}
          score={score}
          setScore={setScore}
          comment={comment}
          setComment={setComment}
          submitting={submitting}
          myRating={myRating}
        />
      ) : null}
    </PublicPage>
  );
};

export default ChampionDirectoryPage;
