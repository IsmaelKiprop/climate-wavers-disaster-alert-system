import PropTypes from "prop-types";
import { Link } from "react-router-dom";

const statusClass = {
  ongoing: "text-destructive",
  alert: "text-warning",
  warning: "text-warning",
  past: "text-muted",
  resolved: "text-muted",
  contained: "text-muted",
};

const Disasters = ({ disasters }) => {
  if (!disasters || !Array.isArray(disasters) || disasters.length === 0) {
    return (
      <div className="py-6 text-muted text-sm">
        No disaster reports match this view yet. New alerts from the live feed will appear here.
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-w-0">
      {disasters.map((disaster) => {
        const formattedDate = disaster.startDate
          ? new Date(disaster.startDate).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "";
        return (
          <article key={disaster.id} className="py-4 border-b border-border min-w-0">
            <Link to={`/disasters/${encodeURIComponent(disaster.id)}`} className="flex justify-between gap-3 items-start">
              <h2 className="capitalize font-semibold text-primary text-base sm:text-xl min-w-0">
                {disaster.name || disaster.title || [disaster.region, disaster.country].filter(Boolean).join(", ") || disaster.disasterType}
                {formattedDate ? ` (${formattedDate})` : ""}
              </h2>
              <span className="hidden md:inline border border-border px-3 py-2 text-sm shrink-0">
                View details
              </span>
            </Link>
            <div className="mt-2 flex flex-col sm:flex-row sm:flex-wrap gap-x-4 gap-y-1 text-sm">
              <p className={statusClass[disaster.status] || "text-foreground"}>
                <span className="font-medium text-foreground">Status: </span>
                {disaster.status || "undetermined"}
              </p>
              <p>
                <span className="font-medium text-foreground">Type: </span>
                {disaster.disasterType}
              </p>
              <p>
                <span className="font-medium text-foreground">Country: </span>
                {disaster.country}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
};

Disasters.propTypes = {
  disasters: PropTypes.array,
};

export default Disasters;
