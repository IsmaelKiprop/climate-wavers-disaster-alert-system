import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";
import Cookies from "js-cookie";
import { useForm } from "react-hook-form";
import AuthLayout, { AuthField, authButtonClass, authInputClass } from "../../components/AuthLayout";

const PasswordReset = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const uidb64 = location.state?.uidb64 || Cookies.get("uid");
  const token = location.state?.token || Cookies.get("reset_token");
  const hasResetCredentials = Boolean(uidb64 && token);

  const onSubmit = async (data) => {
    if (!hasResetCredentials) {
      navigate("/forgotpassword");
      return;
    }
    try {
      setIsDisabled(true);
      await client.run(
        "patch",
        endpoints.passwordreset,
        { ...data, uidb64, token },
        false,
        {
          info: "Resetting password...",
          success: "Password updated. Sign in with your new password.",
          error: "Reset failed. Request a new link and try again.",
        },
        false,
        false
      );
      Cookies.remove("uid");
      Cookies.remove("reset_token");
      navigate("/login");
    } catch (error) {
      console.log(error);
    } finally {
      setIsDisabled(false);
    }
  };

  if (!hasResetCredentials) {
    return (
      <AuthLayout
        title="Reset link required"
        subtitle="Open the newest reset email, or request a new link."
        panelTitle="Start again"
        panelBody="We need a valid reset link before a new password can be saved."
      >
        <Link to="/forgotpassword" className={`${authButtonClass} inline-flex items-center justify-center`}>
          Request reset link
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a password you have not used here before."
      panelTitle="Reset complete"
      panelBody="After this, you can sign in and continue reporting or following live campaigns."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <AuthField id="password" label="New password" error={errors.password && "At least 6 characters"}>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className={`${authInputClass} pr-16`}
              autoComplete="new-password"
              {...register("password", { required: true, minLength: 6, maxLength: 50 })}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </AuthField>
        <AuthField
          id="confirm_password"
          label="Confirm password"
          error={errors.confirm_password && "Passwords must match"}
        >
          <input
            id="confirm_password"
            type={showPassword ? "text" : "password"}
            className={authInputClass}
            autoComplete="new-password"
            {...register("confirm_password", {
              required: true,
              validate: (value) => value === watch("password"),
            })}
          />
        </AuthField>
        <button type="submit" className={authButtonClass} disabled={isDisabled}>
          {isDisabled ? "Saving..." : "Update password"}
        </button>
      </form>
    </AuthLayout>
  );
};

export default PasswordReset;
