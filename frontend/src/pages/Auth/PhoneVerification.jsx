import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import bgReset from "../../assets/phonereset.svg";

const PhoneVerification = () => {
  const [countryCode, setCountryCode] = useState("+254");
  const [number, setNumber] = useState("");
  const navigate = useNavigate();

  return (
    <div className="lg:h-[100vh] md:h-[100vh] flex justify-between bg-background text-foreground">
      <div
        className="w-[100%] lg:w-[50%] md:w-[50%] bg-cover bg-center hidden lg:flex md:flex"
        style={{ backgroundImage: `url(${bgReset})` }}
      />
      <div className="w-[100%] lg:w-[30%] md:w-[50%] py-8 lg:px-16 md:px-16 px-6 m-auto text-center max-sm:pt-[200px]">
        <h1 className="lg:text-[40px] md:text-[40px] text-[24px] text-primary font-bold mb-4">
          Forgotten Password
        </h1>
        <p className="lg:text-[24px] md:text-[24px] text-[18px] mb-10 text-muted">
          Input Phone Number
        </p>
        <div className="flex justify-between items-center gap-2">
          <label htmlFor="country-code" className="sr-only">
            Country code
          </label>
          <select
            id="country-code"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="w-[28%] h-12 px-2 border border-border bg-surface text-foreground"
          >
            <option value="+254">+254</option>
            <option value="+234">+234</option>
            <option value="+211">+211</option>
            <option value="+1">+1</option>
          </select>
          <label htmlFor="phone-number" className="sr-only">
            Phone number
          </label>
          <input
            id="phone-number"
            type="tel"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="Number"
            className="w-[72%] h-12 px-3 border border-border bg-surface text-foreground"
          />
        </div>
        <button
          type="button"
          className="bg-primary text-primary-foreground py-4 w-full mt-4"
          onClick={() => navigate("/phonecode")}
        >
          Confirm
        </button>
        <div className="flex items-center justify-between my-6 text-muted">
          <p className="border-b border-border w-[45%]" />
          <p>Or</p>
          <p className="border-b border-border w-[45%]" />
        </div>
        <NavLink to="/forgotpassword" className="text-primary">
          Use Email instead?
        </NavLink>
      </div>
    </div>
  );
};

export default PhoneVerification;
