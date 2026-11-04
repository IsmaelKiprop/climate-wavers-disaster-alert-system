import { NavLink } from "react-router-dom";
import { useState } from "react";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";
import AuthLayout, { AuthField, authButtonClass, authInputClass } from "../../components/AuthLayout";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isDisabled, setIsDisabled] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setIsDisabled(true);
      await client.run(
        "post",
        endpoints.forgotpassword,
        { email: String(email || "").trim().toLowerCase() },
        false,
        {
          info: "Sending reset link...",
          success: "Check your inbox for a reset link.",
          error: "Could not send the reset email. Wait a moment and try again.",
        },
        false,
        false
      );
    } catch (error) {
      console.log(error);
      // Toast already shown by client; avoid a second Validation Error modal.
    } finally {
      setIsDisabled(false);
    }
  };

  return (
    <AuthLayout
      title="Reset password"
      subtitle="Enter the email on your account. We will send a reset link."
      panelTitle="Recover access"
      panelBody="Use the email you signed up with. The reset link expires after a short time."
    >
      <form onSubmit={handleSubmit}>
        <AuthField id="email" label="Email">
          <input
            id="email"
            type="email"
            required
            className={authInputClass}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </AuthField>
        <button type="submit" className={authButtonClass} disabled={isDisabled}>
          {isDisabled ? "Sending..." : "Send reset link"}
        </button>
      </form>
      <p className="mt-6 text-sm text-center text-muted">
        Remembered it?{" "}
        <NavLink to="/login" className="text-primary font-medium">
          Sign in
        </NavLink>
      </p>
    </AuthLayout>
  );
};

export default ForgotPassword;
