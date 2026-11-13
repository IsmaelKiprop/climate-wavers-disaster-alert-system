import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { apiUrl } from "../config/env";
import { getAuthToken, getUser } from "../utils/factory";

const Payment = ({
  campaignId,
  campaignTitle,
  targetAmount,
  treePrice = 5,
  onSuccess,
}) => {
  const me = getUser() || {};
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState(me.email || "");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(
    Boolean(typeof window !== "undefined" && window.PaystackPop)
  );

  useEffect(() => {
    if (window.PaystackPop) {
      setReady(true);
      return undefined;
    }
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.onload = () => setReady(true);
    script.onerror = () =>
      toast.error("Payment system failed to load. Please refresh.");
    document.body.appendChild(script);
    return () => {
      script.onload = null;
    };
  }, []);

  const verifyPayment = async (reference, checkout) => {
    const token = getAuthToken();
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(apiUrl("/api/v1/verify-payment/"), {
      method: "POST",
      headers,
      body: JSON.stringify({
        reference,
        project_id: checkout.project_id,
        trees_purchased: checkout.trees_purchased,
        donor_name: checkout.donor_name,
        dedication_message: checkout.dedication_message || "",
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.success === false) {
      throw new Error(result?.message || "Payment verification failed.");
    }
    return result;
  };

  const handlePayment = () => {
    if (!email) {
      toast.error("Please enter your email");
      return;
    }
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars < 1) {
      toast.error("Minimum support amount is $1");
      return;
    }
    if (!campaignId) {
      toast.error("This project is missing an id. Refresh and try again.");
      return;
    }
    if (!window.PaystackPop) {
      toast.error("Payment system not ready. Please refresh and try again.");
      return;
    }

    const price = Number(treePrice) > 0 ? Number(treePrice) : 5;
    const treesPurchased = Math.max(1, Math.floor(dollars / price));
    const reference = `project-${campaignId}-${Date.now()}`;
    const donorName =
      `${me.first_name || ""} ${me.last_name || ""}`.trim() ||
      me.username ||
      "Climate Waver";
    const checkout = {
      project_id: Number(campaignId),
      trees_purchased: treesPurchased,
      donor_name: donorName,
      dedication_message: `Campaign support for ${campaignTitle || "Climate Wavers project"}`,
    };
    sessionStorage.setItem(`cw-pay-${reference}`, JSON.stringify(checkout));

    setBusy(true);
    const handler = window.PaystackPop.setup({
      key:
        import.meta.env.VITE_PAYSTACK_PUBLIC_KEY ||
        "pk_test_db7c47322e55b058e66171d4a938e502cb2aff3a",
      email,
      amount: Math.round(dollars * 100),
      currency: "USD",
      ref: reference,
      callback_url: `${window.location.origin}/payment-success`,
      metadata: {
        project_id: String(campaignId),
        trees_purchased: String(treesPurchased),
        donor_name: donorName,
        dedication_message: checkout.dedication_message,
        campaign_title: campaignTitle || "",
        custom_fields: [
          {
            display_name: "Project Id",
            variable_name: "project_id",
            value: String(campaignId),
          },
          {
            display_name: "Trees",
            variable_name: "trees_purchased",
            value: String(treesPurchased),
          },
        ],
      },
      callback: (response) => {
        verifyPayment(response.reference, checkout)
          .then(() => {
            toast.success(
              `Payment recorded. About ${treesPurchased} tree${
                treesPurchased === 1 ? "" : "s"
              } supported.`
            );
            setAmount("");
            onSuccess?.(response.reference);
          })
          .catch((err) => {
            toast.error(
              err?.message ||
                "Payment went through, but verification failed. Contact support with your receipt."
            );
          })
          .finally(() => setBusy(false));
      },
      onClose: () => {
        setBusy(false);
        toast.info("Payment cancelled");
      },
    });
    handler.openIframe();
  };

  return (
    <div className="max-w-md mx-auto bg-surface p-6">
      <h2 className="text-xl font-semibold text-foreground mb-5 text-center">
        Support {campaignTitle}
      </h2>

      <div className="space-y-4">
        <div>
          <label
            className="block text-sm font-medium text-foreground mb-1.5"
            htmlFor="pay-email"
          >
            Email address
          </label>
          <input
            id="pay-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full h-11 px-3 border border-border bg-surface text-foreground"
            style={{ borderRadius: 5 }}
            placeholder="Enter your email"
            required
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium text-foreground mb-1.5"
            htmlFor="pay-amount"
          >
            Amount (USD)
          </label>
          <input
            id="pay-amount"
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-full h-11 px-3 border border-border bg-surface text-foreground"
            style={{ borderRadius: 5 }}
            placeholder="Enter amount in USD"
            min="1"
            step="0.01"
            required
          />
          <p className="mt-1.5 text-xs text-muted">
            About {Number(treePrice) > 0 ? `$${Number(treePrice).toLocaleString()} per tree` : "$5 per tree"}{" "}
            · funds a verified planting project
          </p>
        </div>

        <div
          className="bg-background border border-border p-4"
          style={{ borderRadius: 5 }}
        >
          <p className="text-sm text-muted">
            <span className="font-medium text-foreground">Target amount:</span> $
            {Number(targetAmount || 0).toLocaleString()}
          </p>
        </div>

        <button
          type="button"
          onClick={handlePayment}
          disabled={!ready || busy}
          className="w-full h-11 bg-primary text-primary-foreground font-medium hover:bg-primary-dark disabled:opacity-60"
          style={{ borderRadius: 5 }}
        >
          {!ready ? "Loading payment…" : busy ? "Processing…" : "Support now"}
        </button>
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        Secure payment powered by Paystack · USD
      </p>
    </div>
  );
};

export default Payment;
