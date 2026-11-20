import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { endpoints } from "../utils/endpoints";
import { getAuthToken } from "../utils/factory";
import { apiUrl } from "../config/env";

async function api(path, { method = "GET", body } = {}) {
  const token = getAuthToken();
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(apiUrl(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || "Request failed");
  return data;
}

const PlasticRecyclerDesk = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api(endpoints.plasticRecyclerOffers));
    } catch (err) {
      toast.error(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (document.getElementById("paystack-plastic-lot-script")) return;
    const script = document.createElement("script");
    script.id = "paystack-plastic-lot-script";
    script.src = "https://js.paystack.co/v1/inline.js";
    document.body.appendChild(script);
  }, [load]);

  const accept = async (offer) => {
    setBusyId(offer.id);
    try {
      await api(endpoints.plasticDispatchAccept(offer.id), {
        method: "POST",
        body: {},
      });
      toast.success("Offer accepted");
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const pay = async (offer) => {
    setBusyId(offer.id);
    try {
      const quote = await api(endpoints.plasticDispatchCheckout(offer.id), {
        method: "POST",
        body: {},
      });
      if (!window.PaystackPop) throw new Error("Payment system not ready");
      const partner = data?.partners?.[0];
      const email =
        partner?.contact_email ||
        `${(partner?.contact_phone || "recycler").replace(/\D/g, "")}@pay.climatewavers.local`;
      const paystackKey =
        import.meta.env.VITE_PAYSTACK_PUBLIC_KEY ||
        "pk_test_db7c47322e55b058e66171d4a938e502cb2aff3a";
      const reference = quote.reference;
      sessionStorage.setItem(
        `cw-pay-${reference}`,
        JSON.stringify({
          product: "plastic_dispatch",
          plastic_dispatch_id: offer.id,
          amount_kes: quote.amount_kes,
        })
      );
      const handler = window.PaystackPop.setup({
        key: paystackKey,
        email,
        amount: Math.round(Number(quote.amount_kes) * 100),
        currency: "KES",
        ref: reference,
        metadata: {
          product: "plastic_dispatch",
          plastic_dispatch_id: String(offer.id),
          plastic_project_id: String(offer.project),
          recycler_id: String(offer.recycler),
          kg: String(offer.kg),
          amount_kes: String(quote.amount_kes),
          custom_fields: [
            {
              display_name: "Product",
              variable_name: "product",
              value: "plastic_dispatch",
            },
            {
              display_name: "Dispatch",
              variable_name: "plastic_dispatch_id",
              value: String(offer.id),
            },
          ],
        },
        callback: (response) => {
          window.location.href = `/payment-success?reference=${encodeURIComponent(
            response.reference
          )}&product=plastic_dispatch`;
        },
        onClose: () => toast.info("Payment closed"),
      });
      handler.openIframe();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="p-6 text-muted">Loading recycler desk…</div>;
  }

  if (!data?.is_recycler) {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-3">
        <h1 className="text-2xl font-semibold">Recycler desk</h1>
        <p className="text-sm text-muted">
          {data?.detail || "No approved recycler profile yet."}
        </p>
        <Link
          to="/plastic/recycler-onboard"
          className="inline-flex h-10 px-4 bg-primary text-white text-sm items-center"
        >
          Apply to onboard
        </Link>
      </div>
    );
  }

  const offers = data.offers || [];
  const partner = data.partners?.[0];

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap justify-between gap-3 items-end">
        <div>
          <h1 className="text-2xl font-semibold">Recycler desk</h1>
          <p className="text-sm text-muted mt-1">
            {partner?.name} · {partner?.city} · pay Climate Wavers for lots, we pay
            collectors
          </p>
        </div>
        <Link
          to="/plastic/intake"
          className="h-9 px-3 border border-border text-sm inline-flex items-center"
        >
          Bag scanner
        </Link>
      </div>

      <div className="space-y-3">
        <h2 className="font-medium">Marketplace offers</h2>
        {offers.length === 0 ? (
          <p className="text-sm text-muted border border-border p-4">
            No lots offered to your yard yet.
          </p>
        ) : (
          offers.map((o) => (
            <div key={o.id} className="border border-border p-4 space-y-2">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <div className="font-medium">
                    {o.kg} kg {o.polymer_type}
                  </div>
                  <div className="text-xs text-muted">
                    Project #{o.project} · {o.holding_zone_name || "Holding zone"} ·{" "}
                    {o.status}
                  </div>
                </div>
                <div className="text-sm text-right">
                  <div>Pay CW: KES {o.total_kes ?? "—"}</div>
                  <div className="text-xs text-muted">
                    of which collectors KES {o.collector_share_kes ?? "—"}
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted">
                Payment: {o.payment_status}
                {o.payment_reference ? ` · ${o.payment_reference}` : ""}
              </div>
              <div className="flex flex-wrap gap-2">
                {o.status === "offered" ? (
                  <button
                    type="button"
                    disabled={busyId === o.id}
                    className="h-9 px-3 border border-border text-sm disabled:opacity-60"
                    onClick={() => accept(o)}
                  >
                    Accept
                  </button>
                ) : null}
                {o.payment_status !== "received" && o.total_kes != null ? (
                  <button
                    type="button"
                    disabled={busyId === o.id}
                    className="h-9 px-3 bg-primary text-white text-sm disabled:opacity-60"
                    onClick={() => pay(o)}
                  >
                    {busyId === o.id ? "…" : "Pay Climate Wavers"}
                  </button>
                ) : (
                  <span className="text-xs text-primary self-center">Paid to platform</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PlasticRecyclerDesk;
