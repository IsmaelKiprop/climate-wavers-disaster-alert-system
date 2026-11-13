import { useState } from "react";
import { useNavigate } from "react-router-dom";
import bgReset from "../../assets/nextReset.svg";

const PhoneCode = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  return (
    <div className="lg:h-[100vh] md:h-[100vh] flex justify-between bg-background text-foreground">
      <div
        className="w-[100%] lg:w-[50%] md:w-[50%] bg-cover bg-center hidden lg:flex md:flex"
        style={{ backgroundImage: `url(${bgReset})` }}
      />
      <div className="w-[100%] lg:w-[30%] md:w-[50%] py-8 lg:px-16 md:px-16 px-6 m-auto text-center max-sm:pt-[200px]">
        <h1 className="lg:text-[40px] md:text-[40px] text-[24px] text-primary font-bold mb-4">
          Phone Verification
        </h1>
        <p className="lg:text-[24px] md:text-[24px] text-[18px] mb-10 text-muted">
          Check your phone for verification code
        </p>
        <div className="relative w-[70%] mx-auto my-3">
          <label htmlFor="phone-code" className="sr-only">
            Input code
          </label>
          <input
            id="phone-code"
            type={showPassword ? "text" : "password"}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Input code"
            className="w-full h-12 px-3 pr-16 border border-border bg-surface text-foreground"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted px-2 py-1"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide code" : "Show code"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <button
          type="button"
          className="bg-primary text-primary-foreground py-4 w-[70%] m-2 mt-4"
          onClick={() => navigate("/passwordreset")}
        >
          Confirm
        </button>
      </div>
    </div>
  );
};

export default PhoneCode;
