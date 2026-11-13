import { POST_FONTS } from "../utils/postFonts";

export default function PostFontPicker({
  value,
  onChange,
  className = "",
  compact = false,
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {!compact ? (
        <label htmlFor="post-font" className="text-xs font-medium text-muted">
          Post font
        </label>
      ) : null}
      <div className={`flex flex-wrap ${compact ? "gap-1.5" : "gap-2"}`}>
        {POST_FONTS.map((font) => {
          const selected = value === font.id;
          return (
            <button
              key={font.id}
              id={font.id === value ? "post-font" : undefined}
              type="button"
              onClick={() => onChange(font.id)}
              aria-pressed={selected}
              title={font.label}
              className={`${
                compact ? "min-h-8 px-2.5 text-xs" : "min-h-9 px-3 text-sm"
              } border transition-colors ${
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-foreground hover:border-primary"
              }`}
              style={{ fontFamily: font.family, borderRadius: 5 }}
            >
              {font.label}
            </button>
          );
        })}
      </div>
      {!compact ? (
        <p className="text-xs text-muted">
          Applies to this post — including AI-generated text. You can change it anytime before posting.
        </p>
      ) : null}
    </div>
  );
}
