import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";
import AuthLayout, { AuthField, authButtonClass, fieldInputClass } from "../../components/AuthLayout";

const VerifyMail = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState(Cookies.get("email") || "");
  const [isDisabled, setIsDisabled] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusKind, setStatusKind] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) return;
    try {
      setIsDisabled(true);
      setStatusMessage("");
      const result = await client.run(
        "post",
        endpoints.resendVerification,
        { email: value },
        false,
        {
          info: "Sending a new code",
          success: "If that email has an account, we sent a new code.",
          error: "Could not send the code. Try again later.",
        },
        false,
        true
      );
      Cookies.set("email", value);
      setStatusKind("success");
      setStatusMessage(result?.message || "Check your inbox and spam folder for a 6-digit code.");
      navigate("/emailcode");
    } catch (error) {
      const apiMessage = error?.response?.data?.message;
      setStatusKind("error");
      setStatusMessage(
        typeof apiMessage === "string"
          ? apiMessage
          : "Could not send the code. Try again in a moment."
      );
    } finally {
      setIsDisabled(false);
    }
  };

  return (
    <AuthLayout
      title="Resend verification code"
      subtitle="We'll email a new 6-digit code. Check spam if the first message did not arrive."
      panelTitle="Confirm it is you"
      panelBody="Verification keeps fake accounts out of community alerts."
      panelImage="/environment-sm.jpg"
      panelImageAlt="Waste and pollution the tree campaigns work against"
      panelItems={[
        "Use the same email you signed up with",
        "A new code replaces any earlier code",
        "Then enter it on the verify page",
      ]}
    >
      <form onSubmit={handleSubmit} noValidate>
        <AuthField id="email" label="Email">
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className={fieldInputClass(false)}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </AuthField>
        {statusMessage ? (
          <p role="status" className="mb-4 text-sm text-muted">
            {statusMessage}
          </p>
        ) : null}
        <button type="submit" className={authButtonClass} disabled={isDisabled}>
          {isDisabled ? "Sending..." : "Send a new code"}
        </button>
      </form>
      <p className="mt-6 text-sm text-center text-muted">
        Already have a code?{" "}
        <Link to="/emailcode" className="text-primary font-medium hover:text-primary-dark">
          Enter it here
        </Link>
      </p>
    </AuthLayout>
  );
};

export default VerifyMail;
