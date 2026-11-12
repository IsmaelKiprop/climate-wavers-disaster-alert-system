/**
 * Official WaverX mascot mark (nav + headers).
 * Accepts `size` like react-icons so it drops into AppNav / FooterBar.
 */
export default function WaverXIcon({
  size = 20,
  className = "",
  alt = "",
  src = "/waverbot.png",
  ...rest
}) {
  const px = typeof size === "number" ? size : 20;
  return (
    <img
      src={src}
      alt={alt}
      width={px}
      height={px}
      className={`object-contain shrink-0 ${className}`}
      style={{ width: px, height: px, borderRadius: "50%" }}
      decoding="async"
      aria-hidden={alt ? undefined : true}
      {...rest}
    />
  );
}
