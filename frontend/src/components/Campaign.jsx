const Campaign = ({ campaign }) => {
  const goal = Number(campaign.amount) || 0;
  const raised = Number(campaign.raised) || 0;
  const percent = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  const fallback = campaign.fallbackImage || "/environment.jpg";

  return (
    <article className="w-full h-full bg-surface border border-border overflow-hidden flex flex-col">
      <div className="relative h-44 bg-background">
        <img
          src={campaign.image || fallback}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onError={(event) => {
            if (event.target.dataset.fallback === "done") return;
            event.target.dataset.fallback = "done";
            event.target.src = fallback;
          }}
        />
        <div className="absolute inset-x-0 bottom-0 p-3 bg-black/55 text-white">
          <h2 className="font-semibold text-base leading-5">{campaign.title}</h2>
          <p className="mt-1 text-xs leading-4 line-clamp-2">{campaign.details}</p>
        </div>
      </div>
      <div className="p-3 flex-1 flex flex-col gap-2">
        <p className="text-sm text-muted">
          {campaign.city ? `${campaign.city}, ${campaign.country}` : campaign.country}
        </p>
        <div className="h-1.5 bg-background overflow-hidden" aria-hidden="true">
          <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-primary">
            ${raised.toLocaleString()} / ${goal.toLocaleString()}
          </span>
          <span className="text-muted">
            {Number(campaign.trees_planted || 0).toLocaleString()} / {Number(campaign.target_trees || 0).toLocaleString()} trees
          </span>
        </div>
        <span className="mt-auto inline-flex h-10 items-center justify-center bg-primary text-primary-foreground text-sm font-medium">
          Support this project
        </span>
      </div>
    </article>
  );
};

export default Campaign;
