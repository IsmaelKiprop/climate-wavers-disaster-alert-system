import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FaTree, FaLeaf, FaSeedling, FaGlobe, FaHeart, FaMapMarkerAlt, FaUsers, FaShare, FaArrowLeft } from 'react-icons/fa';
import { endpoints } from '../utils/endpoints';
import SocialShare from './SocialShare';
import ProjectSEO from './ProjectSEO';
import { apiUrl } from '../config/env';

// Global cache to prevent multiple API calls across the entire app
const globalProjectCache = new Map();

const PublicProjectView = () => {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSocialShare, setShowSocialShare] = useState(false);
  const hasFetched = useRef(false);
  
  // Extract projectId from URL parameters using useMemo to prevent re-extraction
  const projectId = useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('project');
  }, []);

  useEffect(() => {
    // Don't fetch if we already have project data or if we've already fetched
    if (project || hasFetched.current) return;
    
    // Check global cache first
    if (globalProjectCache.has(projectId)) {
      console.log('Using cached project data for:', projectId);
      setProject(globalProjectCache.get(projectId));
      setLoading(false);
      return;
    }
    
    // Make real API calls for both development and production
    console.log('Making real-time API call for project:', projectId);
    
    const fetchProject = async () => {
      hasFetched.current = true;
      
      try {
        setLoading(true);
        
        if (!projectId) {
          setError('No project ID provided');
          setLoading(false);
          return;
        }

        const response = await fetch(apiUrl(`${endpoints.tree_projects}${projectId}/`));
        
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Project access requires authentication. Please sign in to view this project.');
          }
          if (response.status === 404) {
            throw new Error('Project not found');
          }
          throw new Error('We could not load this project right now.');
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('We could not load this project right now.');
        }
        
        const projectData = await response.json();
        globalProjectCache.set(projectId, projectData);
        setProject(projectData);
      } catch (err) {
        console.error('Error fetching project:', err);
        setError(err.message || 'We could not load this project right now.');
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId]); // Only depend on projectId

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading project details...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    const isAuthError = error && error.includes('authentication');
    
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <FaTree className="text-6xl text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isAuthError ? 'Authentication Required' : 'Project Not Found'}
          </h1>
          <p className="text-gray-600 mb-6">
            {isAuthError 
              ? 'This project requires authentication to view. Please sign in to access project details.'
              : (error || 'The project you\'re looking for doesn\'t exist or has been removed.')
            }
          </p>
          <div className="space-y-3">
            {isAuthError && (
              <Link 
                to="/login"
                className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <span>Sign In to View Project</span>
              </Link>
            )}
            <Link 
              to="/"
              className="inline-flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <FaArrowLeft className="w-4 h-4" />
              <span>Back to Climate Wavers</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* SEO for shared project pages */}
      <ProjectSEO project={project} />
      
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Development Notice */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center space-x-4">
              <Link to="/" className="flex items-center space-x-2 text-green-600 hover:text-green-700">
                <FaArrowLeft className="w-4 h-4" />
                <span className="font-medium">Back to Climate Wavers</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowSocialShare(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <FaShare className="w-4 h-4" />
                <span>Share Project</span>
              </button>
              <Link
                to="/login"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Sign In to Plant Trees
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Project Details */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Project Header */}
          <div className="relative">
            {(project.cover_image_url || project.image_url) ? (
              <img 
                src={project.cover_image_url || project.image_url} 
                alt={project.name}
                className="w-full h-64 sm:h-80 object-cover"
              />
            ) : (
              <div className="w-full h-64 sm:h-80 bg-primary flex items-center justify-center">
                <div className="text-center text-white">
                  <FaTree className="text-6xl mx-auto mb-4" />
                  <h2 className="text-2xl font-bold">{project.name}</h2>
                  <p className="text-green-100">Tree Planting Project</p>
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-black bg-opacity-40"></div>
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <h1 className="text-3xl sm:text-4xl font-bold mb-2">{project.name}</h1>
              <div className="flex items-center space-x-4 text-lg">
                <div className="flex items-center space-x-2">
                  <FaMapMarkerAlt className="w-5 h-5" />
                  <span>{project.city}, {project.country}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <FaUsers className="w-5 h-5" />
                  <span>{project.organization_name}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Project Content */}
          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Content */}
              <div className="lg:col-span-2">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">About This Project</h2>
                  <p className="text-gray-700 leading-relaxed">{project.description}</p>
                </div>

                {/* Gallery */}
                {project.gallery_urls && project.gallery_urls.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">Project Gallery</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {project.gallery_urls.map((mediaUrl, index) => {
                        const isVideo = mediaUrl.toLowerCase().match(/\.(mp4|avi|mov|wmv|flv|webm)$/);
                        return (
                          <div key={index} className="relative group">
                            {isVideo ? (
                              <video
                                src={mediaUrl}
                                className="w-full h-32 object-cover rounded-lg shadow-md"
                                controls
                                preload="metadata"
                              />
                            ) : (
                              <img
                                src={mediaUrl}
                                alt={`Project gallery ${index + 1}`}
                                className="w-full h-32 object-cover rounded-lg shadow-md"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Organization Info */}
                <div className="mb-8">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Organization</h3>
                  <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                    {project.organization_logo_url ? (
                      <img 
                        src={project.organization_logo_url} 
                        alt="Organization Logo" 
                        className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <FaUsers className="text-2xl text-green-600" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 text-lg">{project.organization_name}</h4>
                      {project.organization_website && (
                        <a 
                          href={project.organization_website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Visit Website
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Project Stats */}
                <div className="bg-green-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Impact</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Trees Planted</span>
                      <span className="font-semibold text-green-600">{project.trees_planted || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">CO₂ Absorption</span>
                      <span className="font-semibold text-green-600">{project.co2_absorption_per_tree}kg/year</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Project Type</span>
                      <span className="font-semibold text-green-600">{project.project_type}</span>
                    </div>
                  </div>
                </div>

                {/* Call to Action */}
                <div className="bg-blue-50 rounded-lg p-6 text-center">
                  <FaTree className="text-4xl text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Join This Project</h3>
                  <p className="text-gray-600 mb-4">
                    Sign in to Climate Wavers to plant trees in this project and make a real environmental impact.
                  </p>
                  <div className="space-y-3">
                    <Link
                      to="/login"
                      className="block w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-semibold"
                    >
                      Sign In to Plant Trees
                    </Link>
                    <Link
                      to="/signup"
                      className="block w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                    >
                      Create Account
                    </Link>
                  </div>
                </div>

                {/* Benefits */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Why Plant Trees?</h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <FaLeaf className="text-green-600 w-5 h-5" />
                      <span className="text-sm text-gray-700">Combat climate change</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <FaGlobe className="text-green-600 w-5 h-5" />
                      <span className="text-sm text-gray-700">Restore ecosystems</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <FaHeart className="text-green-600 w-5 h-5" />
                      <span className="text-sm text-gray-700">Support local communities</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <FaSeedling className="text-green-600 w-5 h-5" />
                      <span className="text-sm text-gray-700">Create lasting impact</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Social Share Modal */}
      {showSocialShare && (
        <SocialShare 
          project={project} 
          onClose={() => setShowSocialShare(false)} 
        />
      )}
    </div>
  );
};

export default PublicProjectView;
