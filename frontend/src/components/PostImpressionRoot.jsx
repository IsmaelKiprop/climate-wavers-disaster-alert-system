import { useRecordPostImpression } from "../hooks/useRecordPostImpression";

/**
 * Attaches viewport impression tracking to a post card.
 */
export default function PostImpressionRoot({ post, enabled = true, className = "", children }) {
  const ref = useRecordPostImpression(post, enabled);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
