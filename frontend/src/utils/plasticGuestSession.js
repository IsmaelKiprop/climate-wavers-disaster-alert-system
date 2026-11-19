const KEY = "cw-plastic-guest-v1";

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  localStorage.setItem(KEY, JSON.stringify(data || {}));
}

/** Shared guest identity across projects (name + phone). */
export function getPlasticGuestProfile() {
  const all = readAll();
  return {
    guest_name: String(all.guest_name || "").trim(),
    guest_phone: String(all.guest_phone || "").trim(),
  };
}

export function setPlasticGuestProfile({ guest_name, guest_phone }) {
  const all = readAll();
  all.guest_name = String(guest_name || "").trim();
  all.guest_phone = String(guest_phone || "").trim();
  writeAll(all);
  return getPlasticGuestProfile();
}

/** Per-project guest claim token after PIN match. */
export function getPlasticGuestProjectSession(projectId) {
  if (!projectId) return { guest_token: "", hotspot_id: "" };
  const all = readAll();
  const row = all.projects?.[String(projectId)] || {};
  return {
    guest_token: String(row.guest_token || "").trim(),
    hotspot_id: row.hotspot_id ? String(row.hotspot_id) : "",
  };
}

export function setPlasticGuestProjectSession(
  projectId,
  { guest_token, hotspot_id } = {}
) {
  if (!projectId) return;
  const all = readAll();
  if (!all.projects || typeof all.projects !== "object") all.projects = {};
  const key = String(projectId);
  const prev = all.projects[key] || {};
  all.projects[key] = {
    ...prev,
    guest_token:
      guest_token !== undefined
        ? String(guest_token || "").trim()
        : String(prev.guest_token || "").trim(),
    hotspot_id:
      hotspot_id !== undefined
        ? hotspot_id
          ? String(hotspot_id)
          : ""
        : prev.hotspot_id
          ? String(prev.hotspot_id)
          : "",
  };
  writeAll(all);
  return getPlasticGuestProjectSession(projectId);
}
