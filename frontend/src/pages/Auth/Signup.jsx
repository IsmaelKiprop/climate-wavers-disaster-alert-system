import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { client } from "../../api";
import { endpoints } from "../../utils/endpoints";
import { validationRules } from "../../utils/validation";
import { SignupPageSEO } from "../../components/SEOComponents";
import AuthLayout, {
  AuthField,
  AuthSection,
  authButtonClass,
  fieldInputClass,
} from "../../components/AuthLayout";

const Signup = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const [formError, setFormError] = useState("");
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setFocus,
  } = useForm({
    defaultValues: {
      gender: "",
      profession: "",
    },
  });

  const onInvalid = () => {
    const order = [
      "email",
      "username",
      "password",
      "password2",
      "first_name",
      "last_name",
      "country",
      "state",
    ];
    const first = order.find((name) => errors[name]);
    if (first) setFocus(first);
  };

  const onSubmit = async (data) => {
    setFormError("");
    const payload = {
      ...data,
      profession: data.profession?.trim() || undefined,
      gender: data.gender || undefined,
    };
    try {
      setIsDisabled(true);
      await client.run(
        "post",
        endpoints.signup,
        payload,
        false,
        {
          info: "Creating your account",
          success: "Account created. Check your email for a verification code.",
          error: "Could not create the account. Try a different email.",
        },
        false,
        true
      );
      navigate("/emailcode");
    } catch (error) {
      console.log("Signup failed:", error);
      const apiMessage =
        error?.response?.data?.email?.[0] ||
        error?.response?.data?.username?.[0] ||
        error?.response?.data?.detail ||
        error?.response?.data?.message;
      setFormError(
        typeof apiMessage === "string"
          ? apiMessage
          : "Could not create the account. Check the form and try again."
      );
    } finally {
      setIsDisabled(false);
    }
  };

  return (
    <>
      <SignupPageSEO />
      <AuthLayout
        align="start"
        title="Create your account"
        subtitle="We will send a 6-digit code to your email. After that you can follow live alerts, report hazards, and join tree campaigns."
        panelTitle="Join Climate Wavers"
        panelBody="Create an account to report what you see, follow Nairobi tree campaigns, and receive verified alert updates."
        panelItems={[
          "Live earthquake and wildfire events from USGS and NASA",
          "Hazard reports after you confirm your email",
          "Official Climate Wavers tree campaigns in Nairobi",
        ]}
        footerNote="Built with FlowOps Africa in Nairobi. Verify first. Send second."
      >
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate>
          {formError ? (
            <p
              role="alert"
              className="mb-4 px-3 py-2.5 text-sm text-destructive border border-destructive bg-surface"
            >
              {formError}
            </p>
          ) : null}

          <AuthSection title="Account">
            <AuthField
              id="email"
              label="Email"
              error={errors.email?.message}
            >
              <input
                id="email"
                type="email"
                inputMode="email"
                className={fieldInputClass(errors.email)}
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={errors.email ? "true" : "false"}
                aria-describedby={errors.email ? "email-error" : undefined}
                {...register("email", {
                  required: "Enter your email",
                  maxLength: { value: 80, message: "Email is too long" },
                  pattern: {
                    value: validationRules.email.pattern,
                    message: "Enter a valid email address",
                  },
                })}
              />
            </AuthField>
            <AuthField
              id="username"
              label="Username"
              error={errors.username?.message}
              hint="Letters, numbers, and underscores. 3 to 30 characters."
            >
              <input
                id="username"
                className={fieldInputClass(errors.username)}
                autoComplete="username"
                placeholder="climate_waver"
                aria-invalid={errors.username ? "true" : "false"}
                aria-describedby={
                  errors.username ? "username-error" : "username-hint"
                }
                {...register("username", {
                  required: "Choose a username",
                  minLength: { value: 3, message: "At least 3 characters" },
                  maxLength: { value: 30, message: "30 characters or fewer" },
                  pattern: {
                    value: validationRules.username.pattern,
                    message: "Use only letters, numbers, and underscores",
                  },
                })}
              />
            </AuthField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
              <AuthField
                id="password"
                label="Password"
                error={errors.password?.message}
                hint="At least 6 characters."
              >
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className={`${fieldInputClass(errors.password)} pr-16`}
                    autoComplete="new-password"
                    aria-invalid={errors.password ? "true" : "false"}
                    aria-describedby={
                      errors.password ? "password-error" : "password-hint"
                    }
                    {...register("password", {
                      required: "Create a password",
                      minLength: { value: 6, message: "At least 6 characters" },
                      maxLength: { value: 50, message: "50 characters or fewer" },
                    })}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-0 h-11 px-2 text-sm text-muted hover:text-foreground"
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </AuthField>
              <AuthField
                id="password2"
                label="Confirm password"
                error={errors.password2?.message}
              >
                <input
                  id="password2"
                  type={showPassword ? "text" : "password"}
                  className={fieldInputClass(errors.password2)}
                  autoComplete="new-password"
                  aria-invalid={errors.password2 ? "true" : "false"}
                  aria-describedby={errors.password2 ? "password2-error" : undefined}
                  {...register("password2", {
                    required: "Confirm your password",
                    validate: (value) =>
                      value === watch("password") || "Passwords must match",
                  })}
                />
              </AuthField>
            </div>
          </AuthSection>

          <AuthSection title="Profile">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
              <AuthField
                id="first_name"
                label="First name"
                error={errors.first_name?.message}
              >
                <input
                  id="first_name"
                  className={fieldInputClass(errors.first_name)}
                  autoComplete="given-name"
                  aria-invalid={errors.first_name ? "true" : "false"}
                  {...register("first_name", {
                    required: "Enter your first name",
                    maxLength: { value: 50, message: "50 characters or fewer" },
                  })}
                />
              </AuthField>
              <AuthField
                id="last_name"
                label="Last name"
                error={errors.last_name?.message}
              >
                <input
                  id="last_name"
                  className={fieldInputClass(errors.last_name)}
                  autoComplete="family-name"
                  aria-invalid={errors.last_name ? "true" : "false"}
                  {...register("last_name", {
                    required: "Enter your last name",
                    maxLength: { value: 50, message: "50 characters or fewer" },
                  })}
                />
              </AuthField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
              <AuthField id="gender" label="Gender" optional>
                <select
                  id="gender"
                  className={fieldInputClass(false)}
                  {...register("gender")}
                >
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </AuthField>
              <AuthField
                id="profession"
                label="Profession"
                optional
                error={errors.profession?.message}
              >
                <input
                  id="profession"
                  className={fieldInputClass(errors.profession)}
                  autoComplete="organization-title"
                  placeholder="Responder, student, journalist"
                  {...register("profession", {
                    maxLength: { value: 50, message: "50 characters or fewer" },
                  })}
                />
              </AuthField>
            </div>
          </AuthSection>

          <AuthSection title="Location">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
              <AuthField
                id="country"
                label="Country"
                error={errors.country?.message}
              >
                <input
                  id="country"
                  className={fieldInputClass(errors.country)}
                  autoComplete="country-name"
                  aria-invalid={errors.country ? "true" : "false"}
                  {...register("country", {
                    required: "Enter your country",
                    maxLength: { value: 50, message: "50 characters or fewer" },
                  })}
                />
              </AuthField>
              <AuthField
                id="state"
                label="State / region"
                error={errors.state?.message}
              >
                <input
                  id="state"
                  className={fieldInputClass(errors.state)}
                  autoComplete="address-level1"
                  aria-invalid={errors.state ? "true" : "false"}
                  {...register("state", {
                    required: "Enter your state or region",
                    maxLength: { value: 50, message: "50 characters or fewer" },
                  })}
                />
              </AuthField>
            </div>
          </AuthSection>

          <p className="mb-4 text-xs leading-relaxed text-muted">
            By creating an account you agree to the{" "}
            <Link to="/terms-of-service" className="text-primary hover:text-primary-dark">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy-policy" className="text-primary hover:text-primary-dark">
              Privacy Policy
            </Link>
            .
          </p>

          <button type="submit" className={authButtonClass} disabled={isDisabled}>
            {isDisabled ? "Creating account..." : "Create account"}
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
