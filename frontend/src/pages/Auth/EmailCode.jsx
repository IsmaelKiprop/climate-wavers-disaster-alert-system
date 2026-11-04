import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";
import Cookies from "js-cookie";
import { completeAuthSession, safeRedirectPath } from "../../utils/factory";
import AuthLayout, { AuthField, authButtonClass, fieldInputClass } from "../../components/AuthLayout";

const EmailCode = () => {
  const [token, setToken] = useState("");
  const [isDisabled, setIsDisabled] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusKind, setStatusKind] = useState("");
  const navigate = useNavigate();
  const email = Cookies.get("email") || "";
  const params = new URLSearchParams(window.location.search);
  const storedRedirect =
    typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem("authRedirect")
      : null;
  const redirectTo = safeRedirectPath(
    params.get("redirect") || storedRedirect,
    "/onboarding"
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email) {
      setStatusKind("error");
      setStatusMessage("We do not have an email on this device. Resend a code first.");
      return;
    }
    try {
      setIsDisabled(true);
      const response = await client.run(
        "post",
        endpoints.emailcode,
        { email, otp: token.trim() },
        false,
        {
          info: "Confirming email...",
          success: "Email verified. Welcome to Climate Wavers.",
          error: "Invalid or expired code.",
        },
        false,
        false
      );
      await completeAuthSession(response || {});
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("authRedirect");
      }
      navigate(redirectTo, { replace: true });
    } catch (error) {
      console.log("Confirmation failed");
    } finally {
      setIsDisabled(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      navigate("/verifymail");
      return;
    }
    try {
      setResendBusy(true);
      setStatusMessage("");
      const result = await client.run(
        "post",
        endpoints.resendVerification,
        { email },
        false,
        false,
        false,
        false
      );
      setStatusKind("success");
      setStatusMessage(result?.message || "A new code was sent. Check your inbox and spam folder.");
    } catch (error) {
      const apiMessage = error?.response?.data?.message;
      setStatusKind("error");
      setStatusMessage(
        typeof apiMessage === "string"
          ? apiMessage
          : "Could not resend the code. Try again in a moment."
      );
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={
        email
          ? `Enter the 6-digit code we sent to ${email}. Check spam if it is not in the inbox.`
          : "Enter the 6-digit code from your email. If you did not get one, resend it."
      }
      panelTitle="Confirm it is you"
      panelBody="Verification keeps fake accounts out of community alerts."
      panelImage="/environment-sm.jpg"
      panelImageAlt="Waste and pollution the tree campaigns work against"
      panelItems={[
        "The code is 6 digits",
        "A new code replaces the old one",
        "Check spam and promotions if it is late",
      ]}
    >
      <form onSubmit={handleSubmit} noValidate>
        <AuthField id="otp" label="Verification code">
          <input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]*"
            className={`${fieldInputClass(false)} tracking-[0.4em] text-center text-lg`}
            value={token}
            onChange={(event) => setToken(event.target.value.replace(/\D/g, "").slice(0, 6))}
            required
          />
        </AuthField>
        {statusMessage ? (
          <p
            role="status"
            className={`mb-4 text-sm ${statusKind === "error" ? "text-destructive" : "text-muted"}`}
          >
            {statusMessage}
          </p>
        ) : null}
        <button
          type="button"
          className="block mb-5 text-sm text-primary hover:text-primary-dark"
          onClick={handleResend}
          disabled={resendBusy}
        >
          {resendBusy ? "Sending a new code..." : "Did not get a code? Send again"}
        </button>
        <button type="submit" className={authButtonClass} disabled={isDisabled || token.length !== 6}>
          {isDisabled ? "Confirming..." : "Confirm"}
        </button>
      </form>
      <p className="mt-6 text-sm text-center text-muted">
        Use a different email?{" "}
        <Link to="/verifymail" className="text-primary font-medium hover:text-primary-dark">
          Resend from another address
        </Link>
      </p>
    </AuthLayout>
  );
};

export default EmailCode;
