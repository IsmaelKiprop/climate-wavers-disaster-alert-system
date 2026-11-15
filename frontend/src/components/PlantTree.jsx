import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import TreePayment from './TreePayment';
import TreeCertificate from './TreeCertificate';
import SocialShare from './SocialShare';
import ProjectSEO from './ProjectSEO';
import WaversPointsCard from './WaversPointsCard';
import GiftRecipientPicker from './GiftRecipientPicker';
import { FaTree, FaLeaf, FaSeedling, FaGlobe, FaHeart, FaMapMarkerAlt, FaUsers, FaFilter, FaShare, FaExpand, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { endpoints } from '../utils/endpoints';
import { getAuthToken, getUser } from '../utils/factory';
import { useExchangeRate } from '../hooks/useExchangeRate';
import ProjectCard from './ProjectCard';
import TreeAnalyticsPanel from './TreeAnalyticsPanel';
import { client } from '../api';
import { apiUrl } from '../config/env';
import { unwrapList } from '../utils/apiData';
import { normalizeTreeSpecies } from '../utils/treeSpecies';

const PlantTree = () => {
  const navigate = useNavigate();
  const { userId: giftUserIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const giftUserId = giftUserIdParam || searchParams.get("for") || "";
  const giftName = searchParams.get("name") || "";
  const giftProjectId = searchParams.get("project") || "";
  const giftSpecies = searchParams.get("species") || "";
  const climateEventId = searchParams.get("event") || "";
  const [climateEventTitle, setClimateEventTitle] = useState("");
  const [giftProfile, setGiftProfile] = useState(null);
  const [selectedTree, setSelectedTree] = useState(null);
  const [showCertificate, setShowCertificate] = useState(false);
  const [userTrees, setUserTrees] = useState([]);
  const [totalTreesPlanted, setTotalTreesPlanted] = useState(0);
  const [userStats, setUserStats] = useState({
    treesPlanted: 0,
    co2Offset: 0,
    impactScore: 0
  });
  
  // African Projects State
  const [africanProjects, setAfricanProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showProjectDetails, setShowProjectDetails] = useState(false);
  const [showSocialShare, setShowSocialShare] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(null);
  const [filters, setFilters] = useState({
    country: '',
    project_type: '',
    search: ''
  });

  // Removed dummy tree types - now using real African projects only

  useEffect(() => {
    if (!giftUserId) {
      setGiftProfile(null);
      return;
    }
    let alive = true;
    client
      .run("get", `${endpoints.users}${giftUserId}/public/`, {}, false)
      .then((data) => {
        if (alive) setGiftProfile(data);
      })
      .catch(() => {
        if (alive) {
          setGiftProfile({
            id: giftUserId,
            display_name: giftName || "a Climate Wavers member",
          });
        }
      });
    return () => {
      alive = false;
    };
  }, [giftUserId, giftName]);

  useEffect(() => {
    if (!climateEventId) {
      setClimateEventTitle("");
      return;
    }
    let alive = true;
    client
      .run("get", `${endpoints.climateEvents}${climateEventId}/`, {}, true)
      .then((data) => {
        if (alive) setClimateEventTitle(data?.title || "Climate day");
      })
      .catch(() => {
        if (alive) setClimateEventTitle("Climate day");
      });
    return () => {
      alive = false;
    };
  }, [climateEventId]);

  useEffect(() => {
    if (galleryIndex == null || !selectedProject) return undefined;
    const gallery = Array.isArray(selectedProject.gallery_urls)
      ? selectedProject.gallery_urls.filter(Boolean)
      : [];
    const onKey = (e) => {
      if (e.key === "Escape") setGalleryIndex(null);
      if (e.key === "ArrowLeft" && gallery.length) {
        setGalleryIndex((i) => (i - 1 + gallery.length) % gallery.length);
      }
      if (e.key === "ArrowRight" && gallery.length) {
        setGalleryIndex((i) => (i + 1) % gallery.length);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [galleryIndex, selectedProject]);

  // Load user's tree data from database
  useEffect(() => {
    const fetchUserTrees = async () => {
      try {
        const user = getUser();
        if (!user?.id) return;

        // Fetch user's tree donations from the database
        const token = getAuthToken();
        const response = await fetch(`${apiUrl(endpoints.treeProjectDonations)}?donor=${user.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch user trees');
        }
        
        const data = await response.json();
        // Handle both array response and paginated response
        const donations = Array.isArray(data) ? data : (data.results || []);
        
        if (donations.length > 0) {
          const trees = donations.map(donation => ({
            id: donation.id,
            name: donation.project_name || 'Tree Planting',
            co2Absorption: donation.co2_absorption_per_tree || 0,
            location: `${donation.project_city || 'Unknown'}, ${donation.project_country || 'Unknown'}`,
            date: donation.created_at,
            amount: donation.amount || 0
          }));
      setUserTrees(trees);
      setTotalTreesPlanted(trees.length);
      
      // Calculate user stats
      const totalCo2 = trees.reduce((sum, tree) => sum + tree.co2Absorption, 0);
      const impactScore = trees.length * 10; // Simple scoring system
      
      setUserStats({
        treesPlanted: trees.length,
        co2Offset: totalCo2,
        impactScore: impactScore
      });
    }
      } catch (error) {
        console.error('Error fetching user trees:', error);
      }
    };

    fetchUserTrees();
    fetchAfricanProjects();
  }, []);

  // Deep-link: /gift/:id?project=&species= → checkout listing all species
  useEffect(() => {
    if (!giftProjectId || !africanProjects.length) return;
    const project = africanProjects.find(
      (p) => String(p.id) === String(giftProjectId)
    );
    if (!project) return;
    if (giftUserId) {
      setSelectedTree({
        ...project,
        name: `${project.name} Tree`,
        description: project.description,
        price: project.tree_price,
        co2Absorption: project.co2_absorption_per_tree,
        tree_species: project.tree_species || [],
        benefits: [
          "Environmental impact",
          "Community benefit",
          "Verified project",
        ],
        plantingLocation: `${project.city}, ${project.country}`,
      });
      return;
    }
    setSelectedProject(project);
    setShowProjectDetails(true);
  }, [giftProjectId, africanProjects, giftUserId]);

  const fetchAfricanProjects = async () => {
    try {
      setLoadingProjects(true);
      const token = getAuthToken();
      
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Add authentication if available, but don't require it
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(apiUrl(endpoints.tree_projects_african), {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        setAfricanProjects(unwrapList(data));
      } else {
        console.error('Failed to fetch African projects');
        setAfricanProjects([]);
      }
    } catch (error) {
      console.error('Error fetching African projects:', error);
      setAfricanProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleTreePurchase = (treeData) => {
    setSelectedTree(treeData);
  };

  const handlePaymentSuccess = (treeData, paymentReference) => {
    const newTree = {
      ...treeData,
      id: Date.now(),
      purchaseDate: new Date().toISOString(),
      paymentReference,
      status: 'planted',
      location: treeData.plantingLocation
    };

    const updatedTrees = [...userTrees, newTree];
    setUserTrees(updatedTrees);
    setTotalTreesPlanted(updatedTrees.length);
    
    // Data is now managed by the database, no localStorage needed
    
    // Update stats
    const totalCo2 = updatedTrees.reduce((sum, tree) => sum + tree.co2Absorption, 0);
    const impactScore = updatedTrees.length * 10;
    
    setUserStats({
      treesPlanted: updatedTrees.length,
      co2Offset: totalCo2,
      impactScore: impactScore
    });

    setShowCertificate(true);
    // Don't immediately close the payment component - let the success modal show first
    // setSelectedTree(null); // This will be called when the success modal is closed
    toast.success(`🌱 Tree planted successfully! You've contributed to a greener planet.`);
  };

  const getProgressPercentage = (current, target) => {
    return Math.min((current / target) * 100, 100);
  };

  const selectGiftRecipient = (user) => {
    if (!user?.id) return;
    const name =
      user.display_name ||
      [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
      user.username ||
      "";
    const params = new URLSearchParams();
    params.set("for", String(user.id));
    if (name) params.set("name", name);
    // Stay on plant-tree so project browsing continues with a selected recipient
    navigate(`/app/plant-tree?${params.toString()}`, { replace: false });
    setGiftProfile({
      ...user,
      display_name: name || "Climate Wavers member",
    });
    toast.success(`Gifting trees to ${name || "this member"}`);
  };

  const clearGiftRecipient = () => {
    navigate("/app/plant-tree", { replace: false });
    setGiftProfile(null);
  };

  return (
    <main className="min-h-screen bg-background py-6 sm:py-8">
      {/* SEO for shared project pages */}
      {selectedProject && <ProjectSEO project={selectedProject} />}
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row items-center justify-center mb-4">
            <FaTree className="text-4xl sm:text-6xl text-green-600 mb-2 sm:mb-0 sm:mr-4" />
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2">
                {climateEventId
                  ? "Gift trees for this Climate day"
                  : giftUserId
                    ? "Gift a Tree"
                    : "Plant a Tree"}
              </h1>
              <p className="text-lg sm:text-xl text-muted px-4 sm:px-0">
                {climateEventId
                  ? `Contribute trees toward ${climateEventTitle || "today's activities"} — invited or not, anyone can gift`
                  : giftUserId
                    ? `Plant trees for ${giftProfile?.display_name || giftName || "this Climate Wavers member"}`
                    : "Make a lasting impact on our planet, one tree at a time"}
              </p>
            </div>
          </div>
          {giftUserId ? (
            <div className="mt-5 mx-auto max-w-xl border border-border bg-surface p-4 sm:p-5 text-left">
              <p className="text-xs font-medium uppercase tracking-wide text-muted mb-3">
                Gifting to
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <img
                  src={
                    giftProfile?.profile_picture &&
                    !String(giftProfile.profile_picture).includes("og-image")
                      ? giftProfile.profile_picture
                      : "/avatar.png"
                  }
                  alt=""
                  className="h-16 w-16 object-cover border border-border bg-background"
                  style={{ borderRadius: "50%" }}
                  onError={(e) => {
                    e.target.src = "/avatar.png";
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold text-foreground">
                    {giftProfile?.display_name || giftName || "Climate Wavers member"}
                  </p>
                  {giftProfile?.username ? (
                    <p className="text-sm text-muted">@{giftProfile.username}</p>
                  ) : null}
                  {(giftProfile?.state || giftProfile?.country || giftProfile?.location) ? (
                    <p className="text-sm text-muted mt-1">
                      {[giftProfile?.location, giftProfile?.state, giftProfile?.country]
                        .filter(Boolean)
                        .filter((v, i, arr) => arr.indexOf(v) === i)
                        .slice(0, 2)
                        .join(", ")}
                    </p>
                  ) : null}
                  {giftProfile?.trees ? (
                    <p className="text-xs text-muted mt-2">
                      {giftProfile.trees.trees_total || 0} trees ·{" "}
                      {giftProfile.trees.trees_gifted_to_them || 0} gifted to them
                    </p>
                  ) : null}
                </div>
                <Link
                  to={`/u/${giftUserId}`}
                  className="min-h-11 inline-flex items-center justify-center px-4 text-sm font-medium border border-border bg-background hover:bg-background/80"
                >
                  View full profile
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        <TreeAnalyticsPanel
          className="mb-6"
          projects={africanProjects}
          userTrees={userTrees}
          userStats={userStats}
        />

        {!giftUserIdParam ? (
          <GiftRecipientPicker
            selectedId={giftUserId || null}
            onSelect={selectGiftRecipient}
            onClear={clearGiftRecipient}
          />
        ) : null}

        <WaversPointsCard projectId={selectedProject?.id || selectedTree?.id || null} />

        {/* User Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 md:mb-8">
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 text-center">
            <FaTree className="text-2xl sm:text-3xl text-green-600 mx-auto mb-2 sm:mb-3" />
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900">{userStats.treesPlanted}</h3>
            <p className="text-sm sm:text-base text-gray-600">Trees Planted</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 text-center">
            <FaLeaf className="text-2xl sm:text-3xl text-blue-600 mx-auto mb-2 sm:mb-3" />
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900">{userStats.co2Offset}kg</h3>
            <p className="text-sm sm:text-base text-gray-600">CO₂ Offset</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 text-center sm:col-span-2 lg:col-span-1">
            <FaHeart className="text-2xl sm:text-3xl text-red-600 mx-auto mb-2 sm:mb-3" />
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900">{userStats.impactScore}</h3>
            <p className="text-sm sm:text-base text-gray-600">Impact Score</p>
          </div>
        </div>

        {/* Global Impact - Removed dummy data */}

        {showCertificate ? (
          <TreeCertificate 
            treeData={userTrees[userTrees.length - 1]}
            onClose={() => setShowCertificate(false)}
          />
        ) : selectedTree ? (
          <TreePayment 
            treeData={selectedTree}
            initialSpecies={giftSpecies}
            climateEventId={climateEventId ? Number(climateEventId) : null}
            climateEventTitle={climateEventTitle}
            giftForUser={
              giftUserId
                ? {
                    id: Number(giftUserId),
                    name: giftProfile?.display_name || giftName || "",
                  }
                : null
            }
            onSuccess={handlePaymentSuccess}
            onBack={() => setSelectedTree(null)}
          />
        ) : (
          <div>
            {/* African Projects Section */}
            <div className="mb-6 md:mb-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4 md:mb-6">
                <div className="mb-4 lg:mb-0">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                    🌍 African Tree Projects
                  </h2>
                  <p className="text-sm sm:text-base text-gray-600">
                    Support verified tree planting projects across Africa
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Search projects..."
                      value={filters.search}
                      onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 w-full sm:w-64 text-sm"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                    <div className="flex items-center space-x-2">
                      <FaFilter className="text-gray-500 text-sm" />
                      <select
                        value={filters.country}
                        onChange={(e) => setFilters(prev => ({ ...prev, country: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm w-full sm:w-auto"
                      >
                        <option value="">All Countries</option>
                        <option value="Nigeria">Nigeria</option>
                        <option value="Kenya">Kenya</option>
                        <option value="Ghana">Ghana</option>
                        <option value="South Africa">South Africa</option>
                        <option value="Tanzania">Tanzania</option>
                        <option value="Uganda">Uganda</option>
                      </select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <select
                        value={filters.project_type}
                        onChange={(e) => setFilters(prev => ({ ...prev, project_type: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm w-full sm:w-auto"
                      >
                        <option value="">All Types</option>
                        <option value="reforestation">Reforestation</option>
                        <option value="urban_greening">Urban Greening</option>
                        <option value="agroforestry">Agroforestry</option>
                        <option value="mangrove_restoration">Mangrove Restoration</option>
                        <option value="community_garden">Community Garden</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {loadingProjects ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {Array.isArray(africanProjects) && africanProjects
                    .filter(project => {
                      if (filters.country && !project.country.toLowerCase().includes(filters.country.toLowerCase())) return false;
                      if (filters.project_type && project.project_type !== filters.project_type) return false;
                      if (filters.search && !project.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
                      return true;
                    })
                    .map((project) => (
                      <ProjectCard
                      key={project.id}
                        project={project}
                        onViewDetails={(project) => {
                                setSelectedProject(project);
                                setShowProjectDetails(true);
                              }}
                        onShare={(project) => {
                                setSelectedProject(project);
                                setShowSocialShare(true);
                              }}
                        onPlantTree={(project) => {
                          handleTreePurchase({
                              ...project,
                              name: `${project.name} Tree`,
                              description: project.description,
                              price: project.tree_price,
                              co2Absorption: project.co2_absorption_per_tree,
                              tree_species: project.tree_species || [],
                              benefits: ['Environmental impact', 'Community benefit', 'Verified project'],
                              plantingLocation: `${project.city}, ${project.country}`
                          });
                        }}
                      />
                  ))}
                </div>
              )}
            </div>

            {/* Removed dummy tree types section - now using real African projects only */}
          </div>
        )}

        {/* My Trees Section */}
        {userTrees.length > 0 && (
          <div className="mt-8 sm:mt-12">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">
              🌱 My Trees
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {userTrees.map((tree) => (
                <div key={tree.id} className="bg-white rounded-lg shadow-md p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base mb-1 sm:mb-0">{tree.name}</h3>
                    <span className="text-xs sm:text-sm text-green-600 bg-green-100 px-2 py-1 rounded-full self-start sm:self-auto">
                      {tree.status}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-2 truncate">{tree.location}</p>
                  <p className="text-xs text-gray-500 mb-2">
                    Planted: {new Date(tree.purchaseDate).toLocaleDateString()}
                  </p>
                  <div className="flex items-center text-xs text-gray-600">
                    <FaLeaf className="mr-1 text-green-600 text-xs" />
                    {tree.co2Absorption}kg CO₂/year
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Project Details Modal */}
        {showProjectDetails && selectedProject && (() => {
          const gallery = Array.isArray(selectedProject.gallery_urls)
            ? selectedProject.gallery_urls.filter(Boolean)
            : [];
          const isVideoUrl = (url) =>
            /\.(mp4|avi|mov|wmv|flv|webm)(\?|$)/i.test(String(url || ""));
          const closeDetails = () => {
            setGalleryIndex(null);
            setShowProjectDetails(false);
            setSelectedProject(null);
          };
          const openLightbox = (index) => setGalleryIndex(index);
          const stepLightbox = (delta) => {
            if (!gallery.length) return;
            setGalleryIndex((prev) => {
              const next = ((prev ?? 0) + delta + gallery.length) % gallery.length;
              return next;
            });
          };
          const progressPct = Number(selectedProject.progress_percentage) || 0;
          const fundingPct = Number(selectedProject.funding_percentage) || 0;

          return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            style={{ background: "rgba(0,0,0,0.72)" }}
            data-project-modal
            onClick={closeDetails}
            role="presentation"
          >
            <div
              className="w-full sm:max-w-4xl max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto border border-border bg-surface sm:mx-4"
              style={{
                borderTopLeftRadius: 12,
                borderTopRightRadius: 12,
              }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="project-details-title"
            >
              <div className="sticky top-0 z-10 border-b border-border bg-surface px-4 sm:px-6 py-3 sm:py-4 flex items-start sm:items-center justify-between gap-3">
                <h2
                  id="project-details-title"
                  className="text-lg sm:text-xl md:text-2xl font-semibold text-foreground leading-snug min-w-0 pr-1"
                >
                  {selectedProject.name}
                </h2>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowSocialShare(true)}
                    className="h-10 px-3 sm:px-4 bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2"
                  >
                    <FaShare className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline sm:inline">Share</span>
                  </button>
                  <button
                    type="button"
                    onClick={closeDetails}
                    className="h-10 w-10 inline-flex items-center justify-center text-muted hover:text-foreground border border-border"
                    aria-label="Close project details"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6">
                {gallery.length > 0 ? (
                  <div className="mb-6 sm:mb-8">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h3 className="text-sm sm:text-base font-semibold text-foreground">
                        Project Gallery
                      </h3>
                      <p className="text-[11px] text-muted">
                        Tap a photo to enlarge · {gallery.length}
                      </p>
                    </div>
                    <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory">
                      {gallery.map((mediaUrl, index) => {
                        const isVideo = isVideoUrl(mediaUrl);
                        return (
                          <button
                            key={`${mediaUrl}-${index}`}
                            type="button"
                            onClick={() => openLightbox(index)}
                            className="relative group shrink-0 w-[72%] max-w-[280px] sm:w-auto sm:max-w-none snap-center border border-border overflow-hidden bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            aria-label={`Open gallery item ${index + 1}`}
                          >
                            {isVideo ? (
                              <video
                                src={mediaUrl}
                                className="w-full h-40 sm:h-32 object-cover pointer-events-none"
                                muted
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              <img
                                src={mediaUrl}
                                alt={`${selectedProject.name} gallery ${index + 1}`}
                                className="w-full h-40 sm:h-32 object-cover"
                                loading="lazy"
                              />
                            )}
                            <span className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors inline-flex items-center justify-center">
                              <FaExpand className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                            </span>
                            {isVideo ? (
                              <span className="absolute bottom-2 left-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 bg-black/70 text-white">
                                Video
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-sm sm:text-base font-semibold text-foreground mb-2">
                        Project Description
                      </h3>
                      <p className="text-sm text-muted leading-relaxed whitespace-pre-wrap">
                        {selectedProject.description}
                      </p>
                    </div>

                    <div>
                      <h3 className="text-sm sm:text-base font-semibold text-foreground mb-2">
                        Organization
                      </h3>
                      <div className="flex items-center gap-3">
                        {selectedProject.organization_logo_url ? (
                          <img
                            src={selectedProject.organization_logo_url}
                            alt=""
                            className="w-11 h-11 object-cover shrink-0 border border-border"
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground text-sm truncate">
                            {selectedProject.organization_name}
                          </p>
                          {selectedProject.organization_website ? (
                            <a
                              href={selectedProject.organization_website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary text-xs break-all hover:underline"
                            >
                              Visit website
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm sm:text-base font-semibold text-foreground mb-2">
                        Location
                      </h3>
                      <div className="flex items-start gap-2 text-sm text-muted">
                        <FaMapMarkerAlt className="mt-0.5 text-primary shrink-0" />
                        <span>
                          {selectedProject.address ||
                            `${selectedProject.city}, ${selectedProject.region}, ${selectedProject.country}`}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm sm:text-base font-semibold text-foreground mb-2">
                        Environmental impact
                      </h3>
                      <div className="space-y-2 text-sm text-muted">
                        <div className="flex items-center gap-2">
                          <FaLeaf className="text-primary shrink-0" />
                          <span>
                            CO₂ absorption: {selectedProject.co2_absorption_per_tree}kg
                            per tree per year
                          </span>
                        </div>
                        {selectedProject.biodiversity_impact ? (
                          <p>
                            <span className="text-foreground font-medium">Biodiversity: </span>
                            {selectedProject.biodiversity_impact}
                          </p>
                        ) : null}
                        {selectedProject.soil_improvement ? (
                          <p>
                            <span className="text-foreground font-medium">Soil: </span>
                            {selectedProject.soil_improvement}
                          </p>
                        ) : null}
                        {selectedProject.water_conservation ? (
                          <p>
                            <span className="text-foreground font-medium">Water: </span>
                            {selectedProject.water_conservation}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="border border-border bg-background p-4 sm:p-5">
                      <h3 className="text-sm sm:text-base font-semibold text-foreground mb-4">
                        Project Progress
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-xs sm:text-sm text-muted mb-1.5">
                            <span>Trees planted</span>
                            <span className="tabular-nums text-foreground">
                              {selectedProject.trees_planted} / {selectedProject.target_trees}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-[var(--cw-overlay-soft)] border border-border overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${Math.min(100, progressPct)}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted mt-1.5 tabular-nums">
                            {progressPct.toFixed(1)}% complete
                          </p>
                        </div>

                        {selectedProject.funding_goal ? (
                          <div>
                            <div className="flex justify-between text-xs sm:text-sm text-muted mb-1.5">
                              <span>Funding</span>
                              <span className="tabular-nums text-foreground">
                                ${Number(selectedProject.funds_raised || 0).toLocaleString()} / $
                                {Number(selectedProject.funding_goal).toLocaleString()}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-[var(--cw-overlay-soft)] border border-border overflow-hidden">
                              <div
                                className="h-full bg-sky-600"
                                style={{ width: `${Math.min(100, fundingPct)}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted mt-1.5 tabular-nums">
                              {fundingPct.toFixed(1)}% funded
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="border border-border bg-background p-4 sm:p-5">
                      <h3 className="text-sm sm:text-base font-semibold text-foreground mb-3">
                        Timeline
                      </h3>
                      <div className="space-y-2 text-sm text-muted">
                        <div className="flex justify-between gap-3">
                          <span>Start</span>
                          <span className="text-foreground tabular-nums">
                            {selectedProject.start_date
                              ? new Date(selectedProject.start_date).toLocaleDateString()
                              : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span>Expected completion</span>
                          <span className="text-foreground tabular-nums">
                            {selectedProject.expected_completion
                              ? new Date(selectedProject.expected_completion).toLocaleDateString()
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border border-border bg-background p-4 sm:p-5">
                      <h3 className="text-sm sm:text-base font-semibold text-foreground mb-3">
                        Tree information
                      </h3>
                      <div className="space-y-2 text-sm text-muted">
                        <div className="flex justify-between gap-3">
                          <span>Price per tree</span>
                          <span className="font-medium text-foreground tabular-nums">
                            ${Number(selectedProject.tree_price || 0).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="block mb-1 text-foreground">Species</span>
                          {normalizeTreeSpecies(selectedProject.tree_species).length > 0 ? (
                            <ul className="space-y-1">
                              {normalizeTreeSpecies(selectedProject.tree_species).map((s) => {
                                const rem =
                                  s.remaining != null
                                    ? s.remaining
                                    : s.target > 0
                                      ? Math.max(0, s.target - (s.planted || 0))
                                      : null;
                                return (
                                  <li key={s.name} className="flex justify-between gap-2">
                                    <span>{s.name}</span>
                                    {s.target > 0 ? (
                                      <span className="tabular-nums shrink-0">
                                        {(s.planted || 0).toLocaleString()}/
                                        {s.target.toLocaleString()}
                                        {rem != null ? ` · ${rem.toLocaleString()} left` : ""}
                                      </span>
                                    ) : null}
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <span>Various</span>
                          )}
                        </div>
                        {selectedProject.project_type ? (
                          <div className="flex justify-between gap-3">
                            <span>Type</span>
                            <span className="capitalize text-foreground">
                              {String(selectedProject.project_type).replace(/_/g, " ")}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="sticky bottom-0 -mx-4 sm:-mx-6 mt-6 sm:mt-8 px-4 sm:px-6 py-3 sm:py-4 border-t border-border bg-surface flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={closeDetails}
                    className="flex-1 h-11 border border-border text-foreground text-sm font-medium hover:bg-[var(--cw-overlay-soft)]"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeDetails();
                      handleTreePurchase({
                        ...selectedProject,
                        name: `${selectedProject.name} Tree`,
                        description: selectedProject.description,
                        price: selectedProject.tree_price,
                        co2Absorption: selectedProject.co2_absorption_per_tree,
                        tree_species: selectedProject.tree_species || [],
                        benefits: [
                          "Environmental impact",
                          "Community benefit",
                          "Verified project",
                        ],
                        plantingLocation: `${selectedProject.city}, ${selectedProject.country}`,
                      });
                    }}
                    className="flex-1 h-11 bg-primary text-primary-foreground text-sm font-semibold"
                  >
                    Plant tree in this project
                  </button>
                </div>
              </div>
            </div>

            {galleryIndex != null && gallery[galleryIndex] ? (
              <div
                className="fixed inset-0 z-[60] flex flex-col bg-black/92"
                onClick={() => setGalleryIndex(null)}
                role="presentation"
              >
                <div className="flex items-center justify-between px-3 sm:px-4 py-3 text-white">
                  <p className="text-sm tabular-nums">
                    {galleryIndex + 1} / {gallery.length}
                  </p>
                  <button
                    type="button"
                    className="h-10 w-10 inline-flex items-center justify-center text-lg"
                    onClick={() => setGalleryIndex(null)}
                    aria-label="Close gallery"
                  >
                    ✕
                  </button>
                </div>
                <div
                  className="flex-1 flex items-center justify-center px-2 sm:px-12 pb-6 relative min-h-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {gallery.length > 1 ? (
                    <button
                      type="button"
                      className="absolute left-2 sm:left-4 h-11 w-11 inline-flex items-center justify-center bg-white/10 text-white hover:bg-white/20"
                      onClick={() => stepLightbox(-1)}
                      aria-label="Previous"
                    >
                      <FaChevronLeft />
                    </button>
                  ) : null}
                  {isVideoUrl(gallery[galleryIndex]) ? (
                    <video
                      src={gallery[galleryIndex]}
                      className="max-h-[78dvh] max-w-full object-contain"
                      controls
                      autoPlay
                    />
                  ) : (
                    <img
                      src={gallery[galleryIndex]}
                      alt={`${selectedProject.name} ${galleryIndex + 1}`}
                      className="max-h-[78dvh] max-w-full object-contain"
                    />
                  )}
                  {gallery.length > 1 ? (
                    <button
                      type="button"
                      className="absolute right-2 sm:right-4 h-11 w-11 inline-flex items-center justify-center bg-white/10 text-white hover:bg-white/20"
                      onClick={() => stepLightbox(1)}
                      aria-label="Next"
                    >
                      <FaChevronRight />
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          );
        })()}

        {/* Social Share Modal */}
        {showSocialShare && selectedProject && (
          <SocialShare 
            project={selectedProject} 
            onClose={() => setShowSocialShare(false)} 
          />
        )}
      </div>
    </main>
  );
};

export default PlantTree;
