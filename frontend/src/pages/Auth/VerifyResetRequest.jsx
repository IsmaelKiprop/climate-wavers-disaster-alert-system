import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Cookies from "js-cookie";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";
import AuthLayout, { authButtonClass } from "../../components/AuthLayout";

const VerifyResetRequest = () => {
  const { uid, token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("Checking your reset link…");
  const started = useRef(false);

  useEffect(() => {
    if (!uid || !token || started.current) return;
    started.current = true;

    const verifyReset = async () => {
      try {
        Cookies.set("uid", uid, { path: "/" });
        Cookies.set("reset_token", token, { path: "/" });

        // Must be unauthenticated: a stale accessToken would make JWT reject
        // this AllowAny route before the reset token is checked.
        await client.run(
          "get",
          `${endpoints.verifyresetrequest}${uid}/${token}/`,
          {},
          false,
          false,
          false,
          false
        );

        setStatus("ok");
        setMessage("Link confirmed. Choose a new password.");
        navigate("/resetpassword", {
          replace: true,
          state: { uidb64: uid, token },
        });
      } catch (error) {
        console.log(error);
        setStatus("error");
        setMessage(
          error?.response?.data?.message ||
            "This reset link is invalid or has expired. Request a new one."
        );
      }
    };

    verifyReset();
  }, [uid, token, navigate]);

  if (status === "error") {
    return (
      <AuthLayout
        title="Reset link unavailable"
        subtitle={message}
        panelTitle="Request a fresh link"
        panelBody="Password reset links expire for security. Ask for a new one and open the newest email only."
        panelImage="/community-respond-sm.jpg"
        panelImageAlt="Response crew after an emergency"
      >
        <div className="space-y-3">
          <Link
            to="/forgotpassword"
            className={`${authButtonClass} inline-flex items-center justify-center`}
          >
            Send a new reset link
          </Link>
          <Link
            to="/login"
            className="block w-full min-h-11 h-11 border border-border text-foreground font-medium text-center leading-[2.75rem] hover:bg-background"
          >
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Confirming reset link"
      subtitle={message}
      panelTitle="Almost there"
      panelBody="We are checking that this reset link is still valid before you choose a new password."
      panelImage="/community-respond-sm.jpg"
      panelImageAlt="Response crew after an emergency"
    >
      <div
        className="flex items-center gap-3 border border-border bg-surface px-4 py-3 text-sm text-muted"
        style={{ borderRadius: 5 }}
        role="status"
        aria-live="polite"
      >
        <span
          className="inline-block h-4 w-4 border-2 border-primary border-t-transparent animate-spin"
          style={{ borderRadius: "50%" }}
          aria-hidden="true"
        />
        Checking link…
      </div>
    </AuthLayout>
  );
};

export default VerifyResetRequest;
