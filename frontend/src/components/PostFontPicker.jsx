import { POST_FONTS } from "../utils/postFonts";

export default function PostFontPicker({ value, onChange, className = "" }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor="post-font" className="text-xs font-medium text-muted">
        Post font
      </label>
      <div className="flex flex-wrap gap-2">
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
              className={`min-h-9 px-3 text-sm border transition-colors ${
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-foreground hover:border-primary"
              }`}
              style={{ fontFamily: font.family }}
            >
              {font.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted">
        Applies to this post — including AI-generated text. You can change it anytime before posting.
      </p>
    </div>
  );
}
