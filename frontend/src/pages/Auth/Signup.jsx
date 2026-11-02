import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";
import { validateSignupForm, showSuccessMessage } from "../../utils/validation";
import { SignupPageSEO } from "../../components/SEOComponents";
import AuthLayout, { AuthField, authButtonClass, authInputClass } from "../../components/AuthLayout";

const Signup = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    defaultValues: { gender: "male" },
  });

  const onSubmit = async (data) => {
    if (!validateSignupForm(data)) return;
    try {
      setIsDisabled(true);
      await client.run(
        "post",
        endpoints.signup,
        data,
        false,
        {
          info: "Creating your account",
          success: "Account created. Check your email for a verification code.",
          error: "Could not create the account. Try a different email.",
        },
        false,
        true
      );
      showSuccessMessage(
        "Account created",
        "Check your email for a verification code, then continue.",
        () => navigate("/emailcode")
      );
    } catch (error) {
      console.log("Signup failed:", error);
    } finally {
      setIsDisabled(false);
    }
  };

  return (
    <>
      <SignupPageSEO />
      <AuthLayout
        title="Create an account"
        subtitle="Join community reporting, tree projects, and disaster alerts."
        panelTitle="Join Climate Wavers"
        panelBody="Create an account to report hazards, follow campaigns, and receive verified alert updates."
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
            <AuthField id="first_name" label="First name" error={errors.first_name && "Required"}>
              <input id="first_name" className={authInputClass} autoComplete="given-name" {...register("first_name", { required: true, maxLength: 50 })} />
            </AuthField>
            <AuthField id="last_name" label="Last name" error={errors.last_name && "Required"}>
              <input id="last_name" className={authInputClass} autoComplete="family-name" {...register("last_name", { required: true, maxLength: 50 })} />
            </AuthField>
          </div>
          <AuthField id="username" label="Username" error={errors.username && "Required"}>
            <input id="username" className={authInputClass} autoComplete="username" {...register("username", { required: true, maxLength: 50 })} />
          </AuthField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
            <AuthField id="gender" label="Gender">
              <select id="gender" className={authInputClass} {...register("gender")}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </AuthField>
            <AuthField id="profession" label="Profession" error={errors.profession && "Required"}>
              <input id="profession" className={authInputClass} {...register("profession", { required: true, maxLength: 50 })} />
            </AuthField>
          </div>
          <AuthField id="email" label="Email" error={errors.email && "Valid email required"}>
            <input id="email" type="email" className={authInputClass} autoComplete="email" {...register("email", { required: true, maxLength: 80 })} />
          </AuthField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
            <AuthField id="country" label="Country" error={errors.country && "Required"}>
              <input id="country" className={authInputClass} autoComplete="country-name" {...register("country", { required: true, maxLength: 50 })} />
            </AuthField>
            <AuthField id="state" label="State / region" error={errors.state && "Required"}>
              <input id="state" className={authInputClass} {...register("state", { required: true, maxLength: 50 })} />
            </AuthField>
          </div>
          <AuthField id="password" label="Password" error={errors.password && "At least 6 characters"}>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className={`${authInputClass} pr-16`}
                autoComplete="new-password"
                {...register("password", { required: true, minLength: 6, maxLength: 50 })}
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted" onClick={() => setShowPassword((v) => !v)}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </AuthField>
          <AuthField id="password2" label="Confirm password" error={errors.password2 && "Passwords must match"}>
            <input
              id="password2"
              type={showPassword ? "text" : "password"}
              className={authInputClass}
              autoComplete="new-password"
              {...register("password2", {
                required: true,
                validate: (value) => value === watch("password"),
              })}
            />
          </AuthField>
          <button type="submit" className={authButtonClass} disabled={isDisabled}>
            {isDisabled ? "Creating account..." : "Sign up"}
          </button>
        </form>
        <p className="mt-6 text-sm text-center text-muted">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:text-primary-dark">
            Sign in
          </Link>
        </p>
      </AuthLayout>
    </>
  );
};

export default Signup;
