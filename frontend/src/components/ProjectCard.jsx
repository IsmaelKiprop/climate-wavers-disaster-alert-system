import { useMemo } from 'react';
import { FaMapMarkerAlt, FaUsers, FaShare } from 'react-icons/fa';
import { useExchangeRate } from '../hooks/useExchangeRate';
import { projectCoverImage } from '../utils/apiData';
import {
  formatSpeciesList,
  normalizeTreeSpecies,
  speciesInventoryValueUsd,
  speciesUnitPrice,
} from '../utils/treeSpecies';

const ProjectCard = ({ 
  project, 
  onViewDetails, 
  onShare, 
  onPlantTree 
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

  const displayPrice = priceRange.varied ? priceRange.min : priceRange.min || project.tree_price;
  const { exchangeRate, convertedAmount, loading: loadingExchangeRate } = useExchangeRate(displayPrice);
  const kesMax =
    exchangeRate && priceRange.varied
      ? priceRange.max * exchangeRate
      : null;
  const cover = projectCoverImage(project);
  const speciesTitle = formatSpeciesList(project.tree_species, {
    withRemaining: true,
    withPrice: true,
    fallbackPrice: project.tree_price,
  });

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all duration-300 hover:scale-105">
      <div className="h-40 sm:h-48 bg-cover bg-center relative" style={{ backgroundImage: `url(${cover})` }}>
          <div className="absolute inset-0 bg-black bg-opacity-20"></div>
          {project.gallery_urls && project.gallery_urls.length > 0 && (
            <div className="absolute bottom-2 right-2 bg-white bg-opacity-90 rounded-full px-2 py-1 text-xs font-semibold text-gray-700">
              +{project.gallery_urls.length} more
            </div>
          )}
        </div>
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1 sm:mb-0">
            {project.name}
          </h3>
          {project.is_verified && (
            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full self-start sm:self-auto">
              Verified
            </span>
          )}
        </div>
        
        <div className="flex items-center text-xs sm:text-sm text-gray-600 mb-2">
          <FaMapMarkerAlt className="mr-1 sm:mr-2 text-green-600 text-xs sm:text-sm" />
          <span className="truncate">{project.city}, {project.country}</span>
        </div>
        
        <div className="flex items-center text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
          <FaUsers className="mr-1 sm:mr-2 text-blue-600 text-xs sm:text-sm" />
          <span className="truncate">{project.organization_name}</span>
        </div>
        
        <p className="text-gray-600 mb-3 sm:mb-4 text-xs sm:text-sm line-clamp-2">
          {project.short_description || project.description.substring(0, 80) + '...'}
        </p>

        {normalizeTreeSpecies(project.tree_species).length > 0 ? (
          <p
            className="text-xs text-gray-500 mb-3 line-clamp-2"
            title={speciesTitle}
          >
            Species: {speciesTitle}
          </p>
        ) : null}
        
        <div className="mb-3 sm:mb-4 space-y-2">
          <div>
            <div className="flex justify-between text-xs sm:text-sm text-gray-600 mb-1">
              <span className="truncate">Trees: {project.trees_planted} / {project.target_trees}</span>
              <span className="ml-2">{Number(project.progress_percentage || 0).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
              <div
                className="bg-green-600 h-1.5 sm:h-2 rounded-full"
                style={{ width: `${Math.min(100, Number(project.progress_percentage) || 0)}%` }}
              ></div>
            </div>
          </div>
          {funding.goal > 0 ? (
            <div>
              <div className="flex justify-between text-xs sm:text-sm text-gray-600 mb-1">
                <span className="truncate">
                  Funding: ${funding.raised.toLocaleString(undefined, { maximumFractionDigits: 2 })} / $
                  {funding.goal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                <span className="ml-2">{funding.pct.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                <div
                  className="bg-sky-600 h-1.5 sm:h-2 rounded-full"
                  style={{ width: `${Math.min(100, funding.pct)}%` }}
                ></div>
              </div>
            </div>
          ) : null}
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
          <div className="mb-1 sm:mb-0">
            <div className="flex items-center">
              <span className="text-lg sm:text-2xl font-bold text-green-600">
                {priceRange.varied
                  ? `$${priceRange.min.toFixed(2)}–$${priceRange.max.toFixed(2)}`
                  : `$${Number(displayPrice || 0).toFixed(2)}`}
              </span>
              <span className="text-xs sm:text-sm text-gray-500 ml-1">per tree</span>
            </div>
            {loadingExchangeRate ? (
              <div className="text-xs text-gray-500 mt-1">
                Loading exchange rate...
              </div>
            ) : convertedAmount ? (
              <div className="text-sm text-gray-600 mt-1">
                {kesMax
                  ? `≈ KSh${convertedAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}–${kesMax.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  : `≈ KSh${convertedAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              </div>
            ) : null}
          </div>
          <div className="text-left sm:text-right">
            <div className="text-xs sm:text-sm text-gray-600">
              {project.co2_absorption_per_tree}kg CO₂/year
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => onViewDetails(project)}
              className="flex-1 bg-blue-600 text-white py-2 px-3 sm:px-4 rounded-md hover:bg-blue-700 transition-colors font-semibold text-sm sm:text-base"
            >
              View Details
            </button>
            <button
              onClick={() => onShare(project)}
              className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              title="Share Project"
            >
              <FaShare className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => onPlantTree(project)}
            className="w-full bg-green-600 text-white py-2 px-3 sm:px-4 rounded-md hover:bg-green-700 transition-colors font-semibold text-sm sm:text-base"
          >
            Plant Tree
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
