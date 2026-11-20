import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { endpoints } from "../utils/endpoints";
import { apiUrl } from "../config/env";

const CITIES = ["Eldoret", "Nairobi", "Mombasa", "Kisumu"];

async function fetchJson(path) {
  const res = await fetch(apiUrl(path), { headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || "Request failed");
  return data;
}

const PlasticRecyclerDirectory = () => {
  const [city, setCity] = useState("Eldoret");
  const [smallLotsOnly, setSmallLotsOnly] = useState(true);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams();
      if (city) q.set("city", city);
      if (smallLotsOnly) q.set("small_lots", "1");
      const result = await fetchJson(
        `${endpoints.plasticRecyclerDirectory}?${q.toString()}`
      );
      setData(result);
    } catch (err) {
      setError(err.message || "Failed to load directory");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [city, smallLotsOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const recyclers = data?.recyclers || [];
  const notes = data?.ground_notes;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted">Plastic Pulse</p>
          <h1 className="text-3xl font-semibold">Recycler directory</h1>
          <p className="text-sm text-muted max-w-2xl">
            Climate Wavers marketplace: recyclers buy through our platform; we pay
            collectors. Filter Eldoret, Nairobi, Mombasa, and Kisumu yards that can take
            CBO-scale lots.
          </p>
        </div>

        {notes ? (
          <div className="border border-border p-4 text-sm space-y-1 bg-muted/10">
            <p>
              Ground baseline: ~{notes.typical_cbo_weekly_kg} kg/week ·{" "}
              {notes.holding_zones} holding zones · collection{" "}
              {(notes.collection_days || []).join(", ").toUpperCase()}
            </p>
            <p className="text-muted">{notes.tip}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 items-center">
          {CITIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCity(c)}
              className={`h-9 px-3 text-sm border ${
                city === c
                  ? "border-primary text-primary bg-primary/5"
                  : "border-border text-muted"
              }`}
            >
              {c}
            </button>
          ))}
          <label className="flex items-center gap-2 text-sm text-muted ml-2">
            <input
              type="checkbox"
              checked={smallLotsOnly}
              onChange={(e) => setSmallLotsOnly(e.target.checked)}
            />
            Small lots (~40–120 kg)
          </label>
        </div>

        {loading ? <p className="text-muted text-sm">Loading recyclers…</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {!loading && !error && recyclers.length === 0 ? (
          <p className="text-sm text-muted border border-border p-4">
            No directory entries for {city} yet. Seed with{" "}
            <code className="text-xs">python manage.py seed_plastic_recyclers</code>.
          </p>
        ) : null}

        <div className="space-y-3">
          {recyclers.map((r) => (
            <article key={r.id} className="border border-border p-4 space-y-2">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <h2 className="font-medium">{r.name}</h2>
                  <p className="text-sm text-muted">
                    {r.city}
                    {r.address ? ` · ${r.address}` : ""}
                  </p>
                </div>
                <div className="text-xs text-muted text-right">
                  {r.accepts_small_lots ? (
                    <span className="text-primary">Small lots OK</span>
                  ) : (
                    <span>Needs larger volume</span>
                  )}
                  {Number(r.min_buy_kg) > 0 ? (
                    <div>Min ~{r.min_buy_kg} kg</div>
                  ) : null}
                </div>
              </div>
              {Array.isArray(r.materials_accepted) && r.materials_accepted.length ? (
                <p className="text-xs text-muted">
                  Materials: {r.materials_accepted.join(", ")}
                </p>
              ) : null}
              {r.buy_rates && Object.keys(r.buy_rates).length ? (
                <p className="text-xs">
                  Indicative KES/kg:{" "}
                  {Object.entries(r.buy_rates)
                    .map(([k, v]) => `${k} ${v}`)
                    .join(" · ")}
                </p>
              ) : null}
              {r.notes ? <p className="text-sm text-muted">{r.notes}</p> : null}
              <div className="flex flex-wrap gap-3 text-sm">
                {r.contact_phone ? (
                  <a
                    className="text-primary hover:underline"
                    href={`tel:${r.contact_phone}`}
                  >
                    {r.contact_phone}
                  </a>
                ) : null}
                {r.website ? (
                  <a
                    className="text-primary hover:underline"
                    href={r.website}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Website
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>

        <p className="text-sm text-muted">
          Recyclers:{" "}
          <Link to="/plastic/recycler-onboard" className="text-primary hover:underline">
            onboard here
          </Link>{" "}
          → then buy lots on{" "}
          <Link to="/plastic/desk" className="text-primary hover:underline">
            recycler desk
          </Link>
          . CBOs:{" "}
          <Link to="/app/admin/plastic" className="text-primary hover:underline">
            Plastic Pulse admin
          </Link>
          .
        </p>
      </div>
    </div>
  );
};

export default PlasticRecyclerDirectory;
