import { lazy, Suspense } from "react";

const EmojiPicker = lazy(() => import("emoji-picker-react"));

/** Loads the heavy emoji pack only when the picker is opened. */
export default function LazyEmojiPicker(props) {
  return (
    <Suspense
      fallback={
        <div className="flex h-[350px] w-[300px] items-center justify-center border border-border bg-surface text-sm text-muted">
          Loading emoji…
        </div>
      }
    >
      <EmojiPicker {...props} />
    </Suspense>
  );
}
