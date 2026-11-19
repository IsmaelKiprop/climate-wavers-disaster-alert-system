import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { endpoints } from "../utils/endpoints";
import { apiUrl } from "../config/env";
import { getAuthToken, getUser } from "../utils/factory";
import { useExchangeRate } from "../hooks/useExchangeRate";
import PlantingProofMediaCarousel, {
  proofMediaFromArrays,
} from "./PlantingProofMediaCarousel";
import PlasticImpactCharts from "./PlasticImpactCharts";

const PublicPlasticView = () => {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [kg, setKg] = useState(10);
  const [email, setEmail] = useState(() => getUser()?.email || "");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [paying, setPaying] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  const amountUsd = useMemo(() => {
    const price = Number(project?.sponsor_price_usd_per_kg || 1);
    return Math.max(0, Number(kg) || 0) * price;
  }, [project, kg]);

  const { exchangeRate, convertedAmount, loading: fxLoading } = useExchangeRate(amountUsd);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(apiUrl(endpoints.plasticProject(projectId)));
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Not found");
        if (alive) setProject(data);
      } catch (err) {
        if (alive) toast.error(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (document.getElementById("paystack-plastic-script")) return;
    const script = document.createElement("script");
    script.id = "paystack-plastic-script";
    script.src = "https://js.paystack.co/v1/inline.js";
    document.body.appendChild(script);
  }, []);

  const shareUrl = `${window.location.origin}/plastic/${projectId}`;

  const sponsor = async ({ redeemPoints = false } = {}) => {
    if (!project) return;
    if (!redeemPoints && (!email || fxLoading || !convertedAmount)) {
      toast.error("Enter email and wait for exchange rate");
      return;
    }
    const token = getAuthToken();
    try {
      if (redeemPoints) setRedeeming(true);
      else setPaying(true);

      const quoteRes = await fetch(apiUrl(endpoints.plasticSponsor(project.id)), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          kg: Number(kg),
          dedication_message: message,
          sponsor_name: name,
          redeem_points: redeemPoints,
        }),
      });
      const quote = await quoteRes.json();
      if (!quoteRes.ok) throw new Error(quote.detail || "Checkout failed");

      if (quote.redeemed) {
        toast.success(`Redeemed ${kg} kg · ${quote.certificate_id || "certificate issued"}`);
        return;
      }

      if (!window.PaystackPop) {
        throw new Error("Payment system not ready");
      }

      const paystackKey =
        import.meta.env.VITE_PAYSTACK_PUBLIC_KEY ||
        "pk_test_db7c47322e55b058e66171d4a938e502cb2aff3a";
      const reference = quote.reference;
      const checkout = {
        product: "plastic",
        plastic_project_id: project.id,
        project_id: project.id,
        kg_sponsored: Number(kg),
        amount_usd: amountUsd,
        original_usd: amountUsd,
        usd_kes_rate: exchangeRate || undefined,
        dedication_message: message,
        sponsor_name: name,
      };
      sessionStorage.setItem(`cw-pay-${reference}`, JSON.stringify(checkout));

      const handler = window.PaystackPop.setup({
        key: paystackKey,
        email,
        amount: Math.round(Number(convertedAmount) * 100),
        currency: "KES",
        ref: reference,
        callback_url: `${window.location.origin}/payment-success`,
        metadata: {
          product: "plastic",
          plastic_project_id: String(project.id),
          project_id: String(project.id),
          kg_sponsored: String(kg),
          amount_usd: String(amountUsd),
          usd_kes_rate: exchangeRate ? String(exchangeRate) : "",
          dedication_message: message,
          sponsor_name: name,
          custom_fields: [
            {
              display_name: "Product",
              variable_name: "product",
              value: "plastic",
            },
            {
              display_name: "Plastic Project",
              variable_name: "plastic_project_id",
              value: String(project.id),
            },
            {
              display_name: "Kg Sponsored",
              variable_name: "kg_sponsored",
              value: String(kg),
            },
          ],
        },
        callback: (response) => {
          window.location.href = `/payment-success?reference=${encodeURIComponent(
            response.reference
          )}&product=plastic`;
        },
        onClose: () => toast.info("Payment closed"),
      });
      handler.openIframe();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPaying(false);
      setRedeeming(false);
    }
  };

  if (loading) {
    return <div className="max-w-3xl mx-auto p-6 text-muted">Loading…</div>;
  }
  if (!project) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <p>Project not found.</p>
        <Link to="/app" className="text-primary underline text-sm">
          Back
        </Link>
      </div>
    );
  }

  const progress = Math.min(
    100,
    project.goal_kg > 0
      ? (Number(project.recovered_kg || 0) / Number(project.goal_kg)) * 100
      : 0
  );

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-8">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted">Plastic Pulse</p>
        <h1 className="text-3xl font-semibold text-foreground">{project.name}</h1>
        <p className="text-muted">
          {project.short_description || project.description}
        </p>
        <p className="text-sm text-muted">
          {project.organization_name} · {project.city || project.country}
          {project.flood_zone_flag ? " · drain / flood focus" : ""}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>{Number(project.recovered_kg || 0)} kg recovered</span>
          <span className="text-muted">Goal {Number(project.goal_kg || 0)} kg</span>
        </div>
        <div className="h-2 bg-border overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm pt-2">
          <div className="border border-border p-3">
            <div className="text-muted text-xs">Sponsor impact</div>
            <div className="font-medium">${project.sponsor_price_usd_per_kg}/kg</div>
          </div>
          <div className="border border-border p-3">
            <div className="text-muted text-xs">Market scrap (indicative)</div>
            <div className="font-medium">
              PET KES {project.scrap_pet_kes_per_kg} · HDPE KES {project.scrap_hdpe_kes_per_kg}
            </div>
          </div>
        </div>
      </div>

      <PlasticImpactCharts impact={project.impact} />

      <div className="border border-border p-4 space-y-3">
        <h2 className="font-medium">Sponsor a kilo</h2>
        <p className="text-sm text-muted">
          Funds verified recovery above scrap value. Certificate issued after payment.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          <input
            type="number"
            min="1"
            className="h-10 px-3 border border-border bg-background"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
          />
          <input
            type="email"
            className="h-10 px-3 border border-border bg-background"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="h-10 px-3 border border-border bg-background sm:col-span-2"
            placeholder="Name on certificate"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <textarea
            className="min-h-20 px-3 py-2 border border-border bg-background sm:col-span-2"
            placeholder="Dedication (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <div className="text-sm text-muted">
          ≈ ${amountUsd.toFixed(2)} USD
          {convertedAmount ? ` · KES ${Number(convertedAmount).toFixed(0)}` : ""}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={paying}
            onClick={() => sponsor({ redeemPoints: false })}
            className="h-10 px-4 bg-primary text-white text-sm disabled:opacity-60"
          >
            {paying ? "Opening Paystack…" : "Sponsor with Paystack"}
          </button>
          {getAuthToken() ? (
            <button
              type="button"
              disabled={redeeming}
              onClick={() => sponsor({ redeemPoints: true })}
              className="h-10 px-4 border border-border text-sm"
            >
              {redeeming ? "Redeeming…" : "Redeem Wavers Points"}
            </button>
          ) : null}
          <button
            type="button"
            className="h-10 px-4 border border-border text-sm"
            onClick={() => {
              navigator.clipboard?.writeText(shareUrl);
              toast.success("Link copied");
            }}
          >
            Share link
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-medium">Hotspots</h2>
        {(project.hotspots || []).length === 0 ? (
          <p className="text-sm text-muted">No hotspots yet.</p>
        ) : (
          <ul className="space-y-2">
            {project.hotspots.map((h) => (
              <li key={h.id} className="border border-border p-3 text-sm">
                <div className="font-medium">
                  {h.title || h.location_label || `Hotspot #${h.id}`}
                </div>
                <div className="text-muted">
                  {h.status} · {h.severity}
                  {h.drain_related ? " · flood/drain risk" : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-medium">Recent recoveries</h2>
        {(project.recent_recoveries || []).length === 0 ? (
          <p className="text-sm text-muted">No recoveries yet.</p>
        ) : (
          project.recent_recoveries.map((r) => (
            <div key={r.id} className="border border-border p-3 space-y-2">
              <div className="text-sm flex justify-between gap-2">
                <span>
                  {r.bag_id} · {r.kg_verified || r.kg_claimed} kg · {r.status}
                </span>
                <span className="text-muted">{r.polymer_type}</span>
              </div>
              <PlantingProofMediaCarousel
                items={proofMediaFromArrays(r.images, r.videos)}
              />
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-muted">
        Verify certificates at{" "}
        <Link to="/verify/plastic" className="text-primary underline">
          /verify/plastic
        </Link>
      </p>
    </div>
  );
};

export default PublicPlasticView;
