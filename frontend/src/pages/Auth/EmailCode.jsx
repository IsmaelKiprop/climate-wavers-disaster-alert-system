import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";
import Cookies from "js-cookie";
import { completeAuthSession, safeRedirectPath } from "../../utils/factory";
import AuthLayout, { AuthField, authButtonClass, fieldInputClass } from "../../components/AuthLayout";

const EMAIL_COOKIE_OPTS = { path: "/", sameSite: "Lax" };

const EmailCode = () => {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState(() => Cookies.get("email") || "");
  const [showEmailField] = useState(() => !Cookies.get("email"));
  const [isDisabled, setIsDisabled] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusKind, setStatusKind] = useState("");
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const storedRedirect =
    typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem("authRedirect")
      : null;
  const redirectTo = safeRedirectPath(
    params.get("redirect") || storedRedirect,
    "/onboarding"
  );

  const rememberEmail = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) return "";
    Cookies.set("email", normalized, EMAIL_COOKIE_OPTS);
    setEmail(normalized);
    return normalized;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const resolvedEmail = rememberEmail(email);
    if (!resolvedEmail) {
      setStatusKind("error");
      setStatusMessage("Enter the email you signed up with, then confirm the code.");
      return;
    }
    try {
      setIsDisabled(true);
      const response = await client.run(
        "post",
        endpoints.emailcode,
        { email: resolvedEmail, otp: token.trim() },
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
    const resolvedEmail = rememberEmail(email);
    if (!resolvedEmail) {
      navigate("/verifymail");
      return;
    }
    try {
      setResendBusy(true);
      setStatusMessage("");
      const result = await client.run(
        "post",
        endpoints.resendVerification,
        { email: resolvedEmail },
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
        showEmailField
          ? "Enter the email you signed up with and the 6-digit code from that inbox."
          : `Enter the 6-digit code we sent to ${email}. Check spam if it is not in the inbox.`
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
        {showEmailField ? (
          <AuthField id="email" label="Email">
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              className={fieldInputClass(false)}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </AuthField>
        ) : null}
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
