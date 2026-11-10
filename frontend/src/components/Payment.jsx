import { useEffect, useState } from "react";
import { toast } from "react-toastify";

const Payment = ({ campaignId, campaignTitle, targetAmount }) => {
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState("");
  const [ready, setReady] = useState(Boolean(typeof window !== "undefined" && window.PaystackPop));

  useEffect(() => {
    if (window.PaystackPop) {
      setReady(true);
      return undefined;
    }
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.onload = () => setReady(true);
    script.onerror = () => toast.error("Payment system failed to load. Please refresh.");
    document.body.appendChild(script);
    return () => {
      script.onload = null;
    };
  }, []);

  const handlePayment = () => {
    if (!amount || !email) {
      toast.error("Please fill in all fields");
      return;
    }
    if (parseInt(amount, 10) < 100) {
      toast.error("Minimum support amount is ₦100");
      return;
    }
    if (!window.PaystackPop) {
      toast.error("Payment system not ready. Please refresh and try again.");
      return;
    }

    const handler = window.PaystackPop.setup({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "pk_test_db7c47322e55b058e66171d4a938e502cb2aff3a",
      email,
      amount: parseInt(amount, 10) * 100,
      currency: "NGN",
      ref: `${campaignId || "campaign"}-${Date.now()}`,
      metadata: {
        campaign_id: campaignId,
        campaign_title: campaignTitle,
      },
      callback: () => {
        toast.success("Payment successful. Thank you for supporting Climate Wavers.");
        setAmount("");
        setEmail("");
      },
      onClose: () => toast.info("Payment cancelled"),
    });
    handler.openIframe();
  };

  return (
    <div className="max-w-md mx-auto bg-surface border border-border p-6" style={{ borderRadius: 5 }}>
      <h2 className="text-xl font-semibold text-foreground mb-5 text-center">
        Support {campaignTitle}
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="pay-email">
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
          <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="pay-amount">
            Amount (NGN)
          </label>
          <input
            id="pay-amount"
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-full h-11 px-3 border border-border bg-surface text-foreground"
            style={{ borderRadius: 5 }}
            placeholder="Enter amount"
            min="100"
            required
          />
        </div>

        <div className="bg-background border border-border p-4" style={{ borderRadius: 5 }}>
          <p className="text-sm text-muted">
            <span className="font-medium text-foreground">Target amount:</span> ₦
            {Number(targetAmount || 0).toLocaleString()}
          </p>
        </div>

        <button
          type="button"
          onClick={handlePayment}
          disabled={!ready}
          className="w-full h-11 bg-primary text-primary-foreground font-medium hover:bg-primary-dark disabled:opacity-60"
          style={{ borderRadius: 5 }}
        >
          {ready ? "Support now" : "Loading payment…"}
        </button>
      </div>

      <p className="mt-4 text-center text-xs text-muted">Secure payment powered by Paystack</p>
    </div>
  );
};

export default Payment;
