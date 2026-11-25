import { useMemo } from 'react';
import { FaMapMarkerAlt, FaUsers, FaShare } from 'react-icons/fa';
import { useExchangeRate } from '../hooks/useExchangeRate';
import { projectCoverImage } from '../utils/apiData';
import {
  formatKes,
  formatUsdKesRate,
  usdToKesAmount,
} from '../utils/exchangeRate';
import {
  formatSpeciesList,
  normalizeTreeSpecies,
  speciesInventoryValueUsd,
  speciesUnitPrice,
} from '../utils/treeSpecies';

function formatUsd(n) {
  return `$${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const ProjectCard = ({
  project,
  onViewDetails,
  onShare,
  onPlantTree,
}) => {
  const priceRange = useMemo(() => {
    const catalog = normalizeTreeSpecies(project.tree_species);
    const fallback = Number(project.tree_price) || 0;
    if (!catalog.length) return { min: fallback, max: fallback, varied: false };
    const prices = catalog.map((s) => speciesUnitPrice(s, fallback));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return { min, max, varied: max - min > 0.001 };
  }, [project.tree_price, project.tree_species]);

  const funding = useMemo(() => {
    const inventoryGoal = speciesInventoryValueUsd(
      project.tree_species,
      project.tree_price
    );
    const goal =
      Number(project.funding_goal) > 0
        ? Number(project.funding_goal)
        : inventoryGoal;
    const raised = Number(project.funds_raised) || 0;
    const pct = goal > 0 ? Math.min(100, (raised / goal) * 100) : 0;
    return { goal, raised, pct };
  }, [
    project.funding_goal,
    project.funds_raised,
    project.tree_price,
    project.tree_species,
  ]);

  const displayPrice = priceRange.varied
    ? priceRange.min
    : priceRange.min || project.tree_price;
  const {
    exchangeRate,
    convertedAmount,
    loading: loadingExchangeRate,
    live,
  } = useExchangeRate(displayPrice);

  const kesMin = convertedAmount;
  const kesMax = priceRange.varied
    ? usdToKesAmount(priceRange.max, exchangeRate)
    : null;

  const cover = projectCoverImage(project);
  const plantingProofCount = Array.isArray(project.updates)
    ? project.updates.filter((update) => update.update_type === 'planting_proof').length
    : 0;
  const species = normalizeTreeSpecies(project.tree_species);
  const speciesTitle = formatSpeciesList(project.tree_species, {
    withRemaining: true,
    withPrice: true,
    fallbackPrice: project.tree_price,
  });

  return (
    <div className="bg-surface border border-border overflow-hidden hover:border-primary/40 transition-colors flex flex-col h-full">
      <div
        className="h-40 sm:h-44 bg-cover bg-center relative shrink-0"
        style={{ backgroundImage: `url(${cover})` }}
      >
        <div className="absolute inset-0 bg-black/25" />
        {project.gallery_urls && project.gallery_urls.length > 0 ? (
          <div className="absolute bottom-2 right-2 bg-background/90 border border-border px-2 py-1 text-[11px] font-medium text-foreground">
            +{project.gallery_urls.length} photos
          </div>
        ) : null}
        {project.is_verified ? (
          <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-[11px] px-2 py-0.5 font-medium">
            Verified
          </span>
        ) : null}
      </div>

      <div className="p-4 sm:p-5 flex flex-col flex-1 min-w-0">
        <h3 className="text-base sm:text-lg font-semibold text-foreground leading-snug line-clamp-2">
          {project.name}
        </h3>

        <div className="mt-2 space-y-1 text-xs text-muted">
          <div className="flex items-center gap-1.5 min-w-0">
            <FaMapMarkerAlt className="text-primary shrink-0" />
            <span className="truncate">
              {project.city}, {project.country}
            </span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <FaUsers className="text-primary shrink-0" />
            <span className="truncate">{project.organization_name}</span>
          </div>
        </div>

        <p className="mt-3 text-sm text-muted line-clamp-2">
          {project.short_description ||
            (project.description
              ? `${String(project.description).slice(0, 100)}…`
              : '')}
        </p>

        {plantingProofCount > 0 ? (
          <button
            type="button"
            onClick={() => onViewDetails(project)}
            className="mt-3 self-start text-xs font-medium text-primary hover:underline"
          >
            {plantingProofCount} planting proof{plantingProofCount === 1 ? '' : 's'} · View photos and location
          </button>
        ) : null}

        {species.length > 0 ? (
          <p className="mt-2 text-xs text-muted" title={speciesTitle}>
            <span className="text-foreground font-medium">
              {species.length} species
            </span>
            <span className="mx-1">·</span>
            <span className="line-clamp-1 inline">
              {species
                .slice(0, 3)
                .map((s) => s.name)
                .join(', ')}
              {species.length > 3 ? ` +${species.length - 3}` : ''}
            </span>
          </p>
        ) : null}

        <div className="mt-4 space-y-2.5">
          <div>
            <div className="flex justify-between gap-2 text-xs text-muted mb-1">
              <span>
                Trees:{' '}
                <span className="text-foreground tabular-nums">
                  {Number(project.trees_planted || 0).toLocaleString()} /{' '}
                  {Number(project.target_trees || 0).toLocaleString()}
                </span>
              </span>
              <span className="tabular-nums shrink-0">
                {Number(project.progress_percentage || 0).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-background border border-border h-1.5">
              <div
                className="bg-primary h-1.5"
                style={{
                  width: `${Math.min(
                    100,
                    Number(project.progress_percentage) || 0
                  )}%`,
                }}
              />
            </div>
          </div>

          {funding.goal > 0 ? (
            <div>
              <div className="flex justify-between gap-2 text-xs text-muted mb-1">
                <span className="min-w-0">
                  Funding:{' '}
                  <span className="text-foreground tabular-nums">
                    {formatUsd(funding.raised)} / {formatUsd(funding.goal)}
                  </span>
                </span>
                <span className="tabular-nums shrink-0">
                  {funding.pct.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-background border border-border h-1.5">
                <div
                  className="bg-sky-500 h-1.5"
                  style={{ width: `${Math.min(100, funding.pct)}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 pt-3 border-t border-border">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted mb-0.5">
                Price per tree
              </p>
              <p className="text-xl sm:text-2xl font-bold text-primary tabular-nums leading-none">
                {priceRange.varied
                  ? `${formatUsd(priceRange.min)}–${formatUsd(priceRange.max)}`
                  : formatUsd(displayPrice)}
              </p>
              {loadingExchangeRate ? (
                <p className="text-xs text-muted mt-1.5">Loading live rate…</p>
              ) : kesMin != null ? (
                <div className="mt-1.5 space-y-0.5">
                  <p className="text-sm text-foreground tabular-nums">
                    {kesMax != null
                      ? `≈ ${formatKes(kesMin)} – ${formatKes(kesMax)}`
                      : `≈ ${formatKes(kesMin)}`}
                  </p>
                  {exchangeRate ? (
                    <p className="text-[11px] text-muted tabular-nums">
                      {formatUsdKesRate(exchangeRate)}
                      {live ? ' · live' : ' · approx'}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="text-right shrink-0 pb-0.5">
              <p className="text-[11px] uppercase tracking-wide text-muted">
                CO₂ / year
              </p>
              <p className="text-sm font-medium text-foreground tabular-nums">
                {Number(project.co2_absorption_per_tree || 0).toFixed(0)} kg
              </p>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-4 flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onViewDetails(project)}
              className="flex-1 h-10 bg-primary text-primary-foreground text-sm font-semibold"
            >
              View Details
            </button>
            <button
              type="button"
              onClick={() => onShare(project)}
              className="h-10 w-10 inline-flex items-center justify-center border border-border text-foreground hover:border-primary"
              title="Share Project"
            >
              <FaShare className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => onPlantTree(project)}
            className="w-full h-10 border border-border text-sm font-semibold text-foreground hover:border-primary"
          >
            Plant Tree
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
