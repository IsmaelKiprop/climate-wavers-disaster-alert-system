/**
 * Warm route chunks on hover/focus so navigation feels instant.
 */

const loaders = {
  "/": () => import("../pages/LandingPage"),
  "/landing": () => import("../pages/LandingPage"),
  "/login": () => import("../pages/Auth/Signin"),
  "/signup": () => import("../pages/Auth/Signup"),
  "/app": () =>
    Promise.all([
      import("../pages/AuthenticatedPages/SharedLayout"),
      import("../pages/AuthenticatedPages/Mainfeed"),
    ]),
  "/app/community": () => import("../pages/AuthenticatedPages/Community"),
  "/app/network": () => import("../pages/AuthenticatedPages/Network"),
  "/app/groups": () => import("../pages/AuthenticatedPages/Groups"),
  "/app/chat": () => import("../pages/AuthenticatedPages/Chat"),
  "/app/notifications": () => import("../pages/AuthenticatedPages/Notification"),
  "/app/waverx": () => import("../pages/AuthenticatedPages/WaverX"),
  "/app/plant-tree": () => import("../components/PlantTree"),
  "/app/alert-settings": () => import("../pages/AuthenticatedPages/AlertSettings"),
  "/app/responder": () => import("../pages/AuthenticatedPages/Responder"),
  "/disasters": () => import("../pages/AuthenticatedPages/Disasters"),
  "/campaigns": () => import("../pages/AuthenticatedPages/Campaigns"),
  "/about": () => import("../pages/AboutPage"),
  "/impact": () => import("../pages/ImpactPage"),
  "/pricing": () => import("../pages/PricingPage"),
};

const warmed = new Set();

function normalizePath(to) {
  if (!to || typeof to !== "string") return "";
  const path = to.split("?")[0].split("#")[0];
  if (path.startsWith("/app/") && path.endsWith("/profile")) {
    return "/app"; // shared layout + profile chunk via app shell
  }
  return path;
}

export function prefetchRoute(to) {
  const path = normalizePath(to);
  if (!path || warmed.has(path)) return;
  const loader = loaders[path];
  if (!loader) {
    // Warm shared app shell for any /app/* path
    if (path.startsWith("/app")) {
      warmed.add("/app");
      loaders["/app"]?.().catch(() => {});
    }
    return;
  }
  warmed.add(path);
  Promise.resolve()
    .then(loader)
    .catch(() => {
      warmed.delete(path);
    });
}

export function prefetchHandlers(to) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    prefetchRoute(to);
  };
  return {
    onMouseEnter: run,
    onFocus: run,
    onTouchStart: run,
  };
}
