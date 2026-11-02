const Campaign = ({ campaign }) => {
  return (
    <article className="w-full bg-surface border border-border overflow-hidden h-full">
      <div
        className="bg-cover bg-center h-48 w-full flex flex-col justify-end p-3"
        style={{ backgroundImage: `url(${campaign.image || "/logo.jpg"})` }}
      >
        <div className="bg-black/70 p-3 text-white">
          <h2 className="font-semibold text-base leading-5">{campaign.title}</h2>
          <p className="mt-1 text-xs leading-4 line-clamp-2">{campaign.details}</p>
        </div>
      </div>
      <div className="p-3 flex items-center justify-between text-sm">
        <span className="text-muted">{campaign.city ? `${campaign.city}, ${campaign.country}` : campaign.country}</span>
        <span className="font-medium text-primary">
          ${Number(campaign.raised || 0).toLocaleString()} / ${Number(campaign.amount || 0).toLocaleString()}
        </span>
      </div>
    </article>
  );
};

export default Campaign;
