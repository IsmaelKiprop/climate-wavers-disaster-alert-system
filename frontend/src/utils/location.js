import Cookies from "js-cookie";

export const getLocation = () => {
  if (!("geolocation" in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      Cookies.set("location", JSON.stringify({ latitude, longitude }), { path: "/" });
    },
    () => {
      // Permission denied or unavailable — stay silent on the dashboard.
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
  );
};
