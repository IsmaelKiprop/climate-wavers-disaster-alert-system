import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";
import Cookies from "js-cookie";
import { useForm } from "react-hook-form";
import AuthLayout, { AuthField, authButtonClass, authInputClass } from "../../components/AuthLayout";

const PasswordReset = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const uidb64 = Cookies.get("uid");
  const token = Cookies.get("reset_token");

  const onSubmit = async (data) => {
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
      navigate("/login");
    } catch (error) {
      console.log(error);
    } finally {
      setIsDisabled(false);
    }
  };

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
