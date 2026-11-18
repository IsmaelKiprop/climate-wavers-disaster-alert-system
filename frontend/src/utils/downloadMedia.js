function guessFilename(url, fallback = "climate-wavers-media") {
  try {
    const path = new URL(url).pathname;
    const base = path.split("/").filter(Boolean).pop() || "";
    if (base && /\.[a-z0-9]{2,5}$/i.test(base)) return base.split("?")[0];
  } catch {
    /* ignore */
  }
  return fallback;
}

/**
 * Download a remote media URL. Falls back to opening a new tab if CORS blocks fetch.
 */
export async function downloadMedia(url, preferredName = "") {
  const src = String(url || "").trim();
  if (!src) return false;

  const filename = preferredName || guessFilename(src);

  try {
    const response = await fetch(src, { mode: "cors", credentials: "omit" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    return true;
  } catch {
    const anchor = document.createElement("a");
    anchor.href = src;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return false;
  }
}
