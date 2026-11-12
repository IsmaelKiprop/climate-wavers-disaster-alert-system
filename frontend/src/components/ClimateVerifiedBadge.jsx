/**
 * Climate Wavers / FlowOps Africa verified seal.
 * Wave + check mark — distinct from generic social ticks.
 */
export default function ClimateVerifiedBadge({
  size = "md",
  showLabel = false,
  className = "",
  title = "Climate Wavers Verified · FlowOps Africa",
}) {
  const dims = {
    sm: { box: 16, icon: 11, text: "text-[9px]", pad: "px-1 py-0.5 gap-0.5" },
    md: { box: 18, icon: 12, text: "text-[10px]", pad: "px-1.5 py-0.5 gap-1" },
    lg: { box: 22, icon: 14, text: "text-[11px]", pad: "px-2 py-1 gap-1.5" },
  }[size] || { box: 18, icon: 12, text: "text-[10px]", pad: "px-1.5 py-0.5 gap-1" };

  return (
    <span
      className={`inline-flex items-center align-middle shrink-0 ${dims.pad} ${className}`}
      style={{
        borderRadius: 5,
        background: "color-mix(in srgb, var(--cw-primary) 14%, transparent)",
        border: "1px solid color-mix(in srgb, var(--cw-primary) 50%, transparent)",
      }}
      title={title}
      aria-label={title}
      role="img"
    >
      <span
        className="inline-flex items-center justify-center shrink-0 text-primary-foreground"
        style={{
          width: dims.box,
          height: dims.box,
          borderRadius: 4,
          background: "var(--cw-primary)",
          boxShadow: "inset 0 0 0 1px color-mix(in srgb, #fff 18%, transparent)",
        }}
      >
        <svg
          width={dims.icon}
          height={dims.icon}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          {/* Horizon wave — FlowOps signal */}
          <path
            d="M2 15.5c2.4-2.8 4.2-2.8 6.6 0 2.3 2.6 4.2 2.6 6.5 0 2.2-2.5 4.1-2.6 6.4-.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.55"
          />
          {/* Rising peak / alert signal */}
          <path
            d="M12 3.5 14.8 9.2H9.2L12 3.5Z"
            fill="currentColor"
            opacity="0.9"
          />
          {/* Verified check anchored on the wave */}
          <path
            d="M7.5 16.2 10.4 19l6.3-7.2"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {showLabel ? (
        <span
          className={`${dims.text} font-semibold uppercase tracking-[0.1em] text-primary leading-none`}
        >
          Verified
        </span>
      ) : null}
    </span>
  );
}
