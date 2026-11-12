/**
 * Keeps brand marks readable in both themes by seating them on a light plate.
 */
export default function BrandLogo({
  src = "/logo.jpg",
  alt = "Climate Wavers",
  className = "",
  imgClassName = "h-8 w-auto",
  decorative = false,
}) {
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 bg-[var(--cw-logo-plate)] p-0.5 border border-[var(--cw-logo-plate-border)] ${className}`}
      style={{ borderRadius: 5 }}
    >
      <img
        src={src}
        alt={decorative ? "" : alt}
        className={`block object-contain ${imgClassName}`}
        style={{ borderRadius: 3 }}
        decoding="async"
      />
    </span>
  );
}
