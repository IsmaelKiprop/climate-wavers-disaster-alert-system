import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";
import { LoginPageSEO } from "../../components/SEOComponents";
import AuthLayout, { AuthField, authButtonClass, fieldInputClass } from "../../components/AuthLayout";

const Signin = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();
  const navigate = useNavigate();
  const redirectTo = new URLSearchParams(window.location.search).get("redirect") || "/app";

  const onSubmit = async (data) => {
    try {
      setIsDisabled(true);
      await client.run(
        "post",
        endpoints.signin,
        data,
        false,
        {
          info: "Signing in",
          error: "Login failed. Check your email and password.",
        },
        true,
        false
      );
      navigate(redirectTo);
    } catch (error) {
      console.log("Login failed:", error);
    } finally {
      setIsDisabled(false);
    }
  };

  return (
    <>
      <LoginPageSEO />
      <AuthLayout
        title="Sign in"
        subtitle="Use your Climate Wavers account to view alerts, reports, and campaigns."
        panelTitle="Sign in to the response workspace"
        panelBody="Monitor alerts, report hazards, and coordinate community response in one place."
        panelItems={[
          "Follow live USGS and NASA events",
          "File a hazard report from the field",
          "Track official Nairobi tree campaigns",
        ]}
        panelImage="/community-respond-sm.jpg"
        panelImageAlt="Crews working a burned structure after a fire"
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <AuthField id="email" label="Email" error={errors.email && "Enter your email"}>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className={fieldInputClass(errors.email)}
              aria-invalid={errors.email ? "true" : "false"}
              {...register("email", { required: true, maxLength: 80 })}
            />
          </AuthField>
          <AuthField id="password" label="Password" error={errors.password && "Enter your password"}>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className={`${fieldInputClass(errors.password)} pr-16`}
                aria-invalid={errors.password ? "true" : "false"}
                {...register("password", { required: true, maxLength: 80 })}
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
          <div className="mb-5 text-right">
            <NavLink to="/forgotpassword" className="text-sm text-primary hover:text-primary-dark">
              Forgot password?
            </NavLink>
          </div>
          <button type="submit" className={authButtonClass} disabled={isDisabled}>
            {isDisabled ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-sm text-center text-muted">
          No account yet?{" "}
          <Link to="/signup" className="text-primary font-medium hover:text-primary-dark">
            Sign up
          </Link>
        </p>
      </AuthLayout>
    </>
  );
};

export default Signin;
