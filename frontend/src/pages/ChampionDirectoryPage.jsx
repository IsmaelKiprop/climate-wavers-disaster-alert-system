import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import PublicPage from "../components/PublicPage";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { getAuthToken } from "../utils/factory";

const Stars = ({ value = 0, onPick, size = "text-sm" }) => (
  <div className={`inline-flex gap-0.5 ${size}`} aria-label={`${value} of 5 stars`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        disabled={!onPick}
        onClick={() => onPick?.(n)}
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

const ChampionDirectoryPage = () => {
  const [rows, setRows] = useState([]);
  const [city, setCity] = useState("");
  const [order, setOrder] = useState("impact");
  const [loading, setLoading] = useState(true);
  const [ratingFor, setRatingFor] = useState(null);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      setRows(data?.results || []);
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

  const submitRating = async (e) => {
    e.preventDefault();
    if (!ratingFor) return;
    if (!getAuthToken()) {
      toast.error("Sign in to rate a champion");
      return;
    }
    setSubmitting(true);
    try {
      const data = await client.run(
        "post",
        endpoints.championsRatings(ratingFor.id),
        { score, comment },
        true
      );
      toast.success("Thanks — rating saved");
      setRows((list) =>
        list.map((c) =>
          c.id === ratingFor.id
            ? {
                ...c,
                rating_avg: data.rating_avg,
                rating_count: data.rating_count,
                impact_score: data.impact_score,
              }
            : c
        )
      );
      setRatingFor(null);
      setComment("");
      setScore(5);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not save rating");
    } finally {
      setSubmitting(false);
    }
  };

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
              Ranked by impact and community ratings — verify, warn, and protect
              neighborhoods.
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
              <li key={c.id} className="border border-border p-4">
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
                  <button
                    type="button"
                    onClick={() => {
                      setRatingFor(c);
                      setScore(5);
                      setComment("");
                    }}
                    className="text-xs font-medium text-primary"
                  >
                    Rate
                  </button>
                </div>
                <p className="text-xs text-muted mt-2">
                  {c.verifications_count || 0} verifications ·{" "}
                  {c.enrollments_count || 0} households ·{" "}
                  {c.proximity_blasts_count || 0} warn blasts
                  {c.sponsor_name ? ` · Sponsored by ${c.sponsor_name}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}

        {ratingFor ? (
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6"
            style={{ background: "rgba(8,12,12,0.72)" }}
            onClick={() => setRatingFor(null)}
          >
            <form
              className="w-full sm:max-w-md bg-surface border border-border p-5 space-y-4 rounded-t-[14px] sm:rounded-[14px]"
              onClick={(e) => e.stopPropagation()}
              onSubmit={submitRating}
            >
              <h3 className="text-lg font-semibold text-foreground">
                Rate {ratingFor.display_name}
              </h3>
              <p className="text-sm text-muted">
                How reliable and helpful is this champion for your community?
              </p>
              <Stars value={score} onPick={setScore} size="text-2xl" />
              <textarea
                className="w-full border border-border p-2 text-sm"
                rows={3}
                maxLength={400}
                placeholder="Optional comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 h-11 bg-primary text-primary-foreground text-sm font-semibold"
                >
                  {submitting ? "Saving…" : "Submit rating"}
                </button>
                <button
                  type="button"
                  onClick={() => setRatingFor(null)}
                  className="h-11 px-4 border border-border text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </PublicPage>
  );
};

export default ChampionDirectoryPage;
