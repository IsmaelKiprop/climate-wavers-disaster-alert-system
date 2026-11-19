import { useState, useEffect } from "react";
import { fetchUsdToKesRateDetailed } from "../utils/exchangeRate";

export const useExchangeRate = (usdAmount) => {
  const [exchangeRate, setExchangeRate] = useState(null);
  const [convertedAmount, setConvertedAmount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [live, setLive] = useState(false);
  const [source, setSource] = useState(null);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchUsdToKesRateDetailed();
        if (!alive) return;

        setExchangeRate(result.rate);
        setLive(Boolean(result.live));
        setSource(result.source || null);
        if (usdAmount) {
          setConvertedAmount(usdAmount * result.rate);
        } else {
          setConvertedAmount(null);
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
    live,
    source,
  };
};
