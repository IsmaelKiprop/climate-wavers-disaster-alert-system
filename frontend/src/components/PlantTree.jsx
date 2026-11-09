import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import TreePayment from './TreePayment';
import TreeCertificate from './TreeCertificate';
import SocialShare from './SocialShare';
import ProjectSEO from './ProjectSEO';
import WaversPointsCard from './WaversPointsCard';
import GiftRecipientPicker from './GiftRecipientPicker';
import { FaTree, FaLeaf, FaSeedling, FaGlobe, FaHeart, FaMapMarkerAlt, FaUsers, FaFilter, FaShare } from 'react-icons/fa';
import { endpoints } from '../utils/endpoints';
import { getAuthToken, getUser } from '../utils/factory';
import { useExchangeRate } from '../hooks/useExchangeRate';
import ProjectCard from './ProjectCard';
import { client } from '../api';
import { apiUrl } from '../config/env';
import { unwrapList } from '../utils/apiData';

const PlantTree = () => {
  const navigate = useNavigate();
  const { userId: giftUserIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const giftUserId = giftUserIdParam || searchParams.get("for") || "";
  const giftName = searchParams.get("name") || "";
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
    
    // Handle URL parameters for shared project links
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('project');
    
    if (projectId && africanProjects.length > 0) {
      const project = africanProjects.find(p => p.id === parseInt(projectId));
      if (project) {
        setSelectedProject(project);
        setShowProjectDetails(true);
        // Scroll to project details
        setTimeout(() => {
          const modal = document.querySelector('[data-project-modal]');
          if (modal) {
            modal.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      }
    }
    
    // Fetch African projects
    fetchAfricanProjects();
  }, []);

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
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                {giftUserId ? "Gift a Tree" : "Plant a Tree"}
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 px-4 sm:px-0">
                {giftUserId
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
        {showProjectDetails && selectedProject && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4" data-project-modal>
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 pr-4">
                    {selectedProject.name}
                  </h2>
                  <div className="flex items-center space-x-2">
                    {/* Share Button */}
                    <button
                      onClick={() => setShowSocialShare(true)}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      <FaShare className="w-4 h-4" />
                      <span className="hidden sm:inline">Share Project</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowProjectDetails(false);
                        setSelectedProject(null);
                      }}
                      className="text-gray-400 hover:text-gray-600 text-xl sm:text-2xl flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Gallery Media Section */}
                {(selectedProject.gallery_urls && selectedProject.gallery_urls.length > 0) && (
                  <div className="mb-6 sm:mb-8">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Project Gallery</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
                      {selectedProject.gallery_urls.map((mediaUrl, index) => {
                        const isVideo = mediaUrl.toLowerCase().match(/\.(mp4|avi|mov|wmv|flv|webm)$/);
                        return (
                          <div key={index} className="relative group">
                            {isVideo ? (
                              <video
                                src={mediaUrl}
                                className="w-full h-24 sm:h-32 object-cover rounded-lg shadow-md hover:shadow-lg transition-shadow"
                                controls
                                preload="metadata"
                              />
                            ) : (
                              <img
                                src={mediaUrl}
                                alt={`Project gallery ${index + 1}`}
                                className="w-full h-24 sm:h-32 object-cover rounded-lg shadow-md hover:shadow-lg transition-shadow"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            )}
                            <div className="hidden absolute inset-0 bg-black bg-opacity-50 rounded-lg items-center justify-center">
                              <span className="text-white text-xs sm:text-sm font-semibold">
                                {isVideo ? '📹 Video' : '🖼️ Image'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                  {/* Project Info */}
                  <div>
                    <div className="mb-4 sm:mb-6">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Project Description</h3>
                      <p className="text-sm sm:text-base text-gray-700">{selectedProject.description}</p>
                    </div>

                    <div className="mb-4 sm:mb-6">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Organization</h3>
                      <div className="flex items-center space-x-3 sm:space-x-4">
                        {selectedProject.organization_logo_url && (
                          <img 
                            src={selectedProject.organization_logo_url} 
                            alt="Organization Logo" 
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover flex-shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">{selectedProject.organization_name}</p>
                          {selectedProject.organization_website && (
                            <a 
                              href={selectedProject.organization_website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm break-all"
                            >
                              Visit Website
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Location</h3>
                      <div className="flex items-center text-gray-700">
                        <FaMapMarkerAlt className="mr-2 text-green-600" />
                        <span>{selectedProject.address || `${selectedProject.city}, ${selectedProject.region}, ${selectedProject.country}`}</span>
                      </div>
                    </div>

                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Environmental Impact</h3>
                      <div className="space-y-2 text-sm text-gray-700">
                        <div className="flex items-center">
                          <FaLeaf className="mr-2 text-green-600" />
                          <span>CO₂ Absorption: {selectedProject.co2_absorption_per_tree}kg per tree per year</span>
                        </div>
                        {selectedProject.biodiversity_impact && (
                          <p><strong>Biodiversity:</strong> {selectedProject.biodiversity_impact}</p>
                        )}
                        {selectedProject.soil_improvement && (
                          <p><strong>Soil Improvement:</strong> {selectedProject.soil_improvement}</p>
                        )}
                        {selectedProject.water_conservation && (
                          <p><strong>Water Conservation:</strong> {selectedProject.water_conservation}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Project Stats */}
                  <div>
                    <div className="bg-green-50 rounded-lg p-6 mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Progress</h3>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm text-gray-600 mb-1">
                            <span>Trees Planted</span>
                            <span>{selectedProject.trees_planted} / {selectedProject.target_trees}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="bg-green-600 h-3 rounded-full"
                              style={{ width: `${selectedProject.progress_percentage}%` }}
                            ></div>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {selectedProject.progress_percentage.toFixed(1)}% Complete
                          </p>
                        </div>

                        {selectedProject.funding_goal && (
                          <div>
                       <div className="flex justify-between text-sm text-gray-600 mb-1">
                         <span>Funding</span>
                         <span>${selectedProject.funds_raised.toLocaleString()} / ${selectedProject.funding_goal.toLocaleString()}</span>
                       </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div
                                className="bg-blue-600 h-3 rounded-full"
                                style={{ width: `${selectedProject.funding_percentage}%` }}
                              ></div>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {selectedProject.funding_percentage.toFixed(1)}% Funded
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-blue-50 rounded-lg p-6 mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Timeline</h3>
                      <div className="space-y-2 text-sm text-gray-700">
                        <div className="flex justify-between">
                          <span>Start Date:</span>
                          <span>{new Date(selectedProject.start_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Expected Completion:</span>
                          <span>{new Date(selectedProject.expected_completion).toLocaleDateString()}</span>
                        </div>
                        {selectedProject.actual_completion && (
                          <div className="flex justify-between">
                            <span>Actual Completion:</span>
                            <span>{new Date(selectedProject.actual_completion).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Tree Information</h3>
                      <div className="space-y-2 text-sm text-gray-700">
                       <div className="flex justify-between">
                         <span>Price per Tree:</span>
                         <span className="font-semibold">${selectedProject.tree_price.toLocaleString()}</span>
                       </div>
                        <div className="flex justify-between">
                          <span>Tree Species:</span>
                          <span>{selectedProject.tree_species?.join(', ') || 'Various'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Project Type:</span>
                          <span className="capitalize">{selectedProject.project_type.replace('_', ' ')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8 pt-4 sm:pt-6 border-t">
                  <button
                    onClick={() => {
                      setShowProjectDetails(false);
                      setSelectedProject(null);
                    }}
                    className="flex-1 bg-gray-200 text-gray-800 py-2 sm:py-3 px-4 rounded-md hover:bg-gray-300 transition-colors font-semibold text-sm sm:text-base"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setShowProjectDetails(false);
                      setSelectedProject(null);
                      handleTreePurchase({
                        ...selectedProject,
                        name: `${selectedProject.name} Tree`,
                        description: selectedProject.description,
                        price: selectedProject.tree_price,
                        co2Absorption: selectedProject.co2_absorption_per_tree,
                        benefits: ['Environmental impact', 'Community benefit', 'Verified project'],
                        plantingLocation: `${selectedProject.city}, ${selectedProject.country}`
                      });
                    }}
                    className="flex-1 bg-green-600 text-white py-2 sm:py-3 px-4 rounded-md hover:bg-green-700 transition-colors font-semibold text-sm sm:text-base"
                  >
                    Plant Tree in This Project
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
