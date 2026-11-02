import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";
import Cookies from "js-cookie";
import AuthLayout, { AuthField, authButtonClass, authInputClass } from "../../components/AuthLayout";

const EmailCode = () => {
  const [token, setToken] = useState("");
  const [isDisabled, setIsDisabled] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setIsDisabled(true);
      await client.run(
        "post",
        endpoints.emailcode,
        { email: Cookies.get("email"), otp: token },
        false,
        {
          info: "Confirming email...",
          success: "Email verified. Welcome to Climate Wavers.",
          error: "Invalid or expired code.",
        },
        false,
        false
      );
      navigate("/onboarding");
    } catch (error) {
      console.log("Confirmation failed");
    } finally {
      setIsDisabled(false);
    }
  };

  return (
    <AuthLayout
      title="Verify your email"
      subtitle="Enter the 6-digit code we sent to your inbox."
      panelTitle="Confirm it is you"
      panelBody="Verification keeps fake accounts out of community alerts."
    >
      <form onSubmit={handleSubmit}>
        <AuthField id="otp" label="Verification code">
          <input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            className={authInputClass}
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        </AuthField>
        <NavLink to="/verifymail" className="block mb-5 text-sm text-primary">
          Did not get a code?
        </NavLink>
        <button type="submit" className={authButtonClass} disabled={isDisabled}>
          {isDisabled ? "Confirming..." : "Confirm"}
        </button>
      </form>
    </AuthLayout>
  );
};

export default EmailCode;
