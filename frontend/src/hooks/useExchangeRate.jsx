import { useState, useEffect } from "react";
import { fetchUsdToKesRate } from "../utils/exchangeRate";

export const useExchangeRate = (usdAmount) => {
  const [exchangeRate, setExchangeRate] = useState(null);
  const [convertedAmount, setConvertedAmount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const usdToKesRate = await fetchUsdToKesRate();
        if (!alive) return;

        setExchangeRate(usdToKesRate);
        if (usdAmount) {
          setConvertedAmount(usdAmount * usdToKesRate);
        }
      } catch (err) {
        if (!alive) return;
        console.error("Failed to fetch exchange rate:", err);
        setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [usdAmount]);

  return {
    exchangeRate,
    convertedAmount,
    loading,
    error,
  };
};
