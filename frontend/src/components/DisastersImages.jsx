import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { disasterCoverImage } from "../utils/apiData";

const DisasterImages = ({ disasters }) => {
  if (!disasters || !Array.isArray(disasters) || disasters.length === 0) {
    return (
      <div className="h-full flex items-center px-4 text-sm text-muted">
        Live alert images will appear here when events load.
      </div>
    );
  }

  const featured = disasters.slice(0, 6);

  return (
    <div className="flex h-full gap-3 overflow-x-auto px-1">
      {featured.map((disaster) => {
        const cover = disaster.image || disaster.images?.[0] || disasterCoverImage(disaster.disasterType);
        const title = disaster.name || disaster.title || [disaster.region, disaster.country].filter(Boolean).join(", ");
        return (
          <Link
            key={disaster.id}
            to={`/disasters/${encodeURIComponent(disaster.id)}`}
            className="relative shrink-0 w-[78vw] sm:w-[320px] h-full overflow-hidden border border-border bg-background"
          >
            <img
              alt={title}
              className="absolute inset-0 w-full h-full object-cover"
              src={cover}
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/45" />
            <div className="relative z-10 h-full flex flex-col justify-end p-4 text-white">
              <p className="text-xs uppercase tracking-wide text-white/80">
                {String(disaster.disasterType || "alert").replace(/_/g, " ")}
                {disaster.source ? ` · ${disaster.source}` : ""}
              </p>
              <h2 className="mt-1 font-semibold text-base leading-snug line-clamp-2">{title}</h2>
              <span className="mt-3 inline-flex h-9 w-fit items-center px-3 bg-primary text-primary-foreground text-sm">
                View details
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
};

DisasterImages.propTypes = {
  disasters: PropTypes.array,
};

export default DisasterImages;
