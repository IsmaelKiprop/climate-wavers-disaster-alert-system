import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaTree, FaLeaf, FaSeedling, FaGlobe, FaHeart, FaMapMarkerAlt, FaUsers, FaCog, FaChartBar, FaEdit, FaTrash, FaPlus, FaEye } from 'react-icons/fa';
import { endpoints } from '../../utils/endpoints';
import { apiUrl } from '../../config/env';

const TreeAdmin = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showProjectDetails, setShowProjectDetails] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch(apiUrl(endpoints.tree_projects));
      if (response.ok) {
        const data = await response.json();
        const list = data.results || data;
        setProjects(Array.isArray(list) ? list.slice(0, 4) : []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <FaCog className="text-4xl text-green-600" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Tree Project Administration
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl">
              Host planting sites, publish projects, and share proof. Apply for a free
              90-day Tree Admin pilot — supporters fund trees with an 18% platform fee.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/tree-admins/apply"
                className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
              >
                Apply as Tree Admin
              </Link>
              <Link
                to="/app/admin/tree-projects"
                className="inline-flex items-center px-6 py-3 border border-green-600 text-green-700 rounded-lg font-medium hover:bg-green-50"
              >
                Open Tree Admin desk
              </Link>
            </div>
          </div>
        </div>

        {/* Admin Features Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-xl p-6 shadow-lg text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaChartBar className="text-2xl text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Project Analytics</h3>
            <p className="text-gray-600">
              Track project performance, tree planting progress, and environmental impact metrics.
            </p>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaEdit className="text-2xl text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Project Management</h3>
            <p className="text-gray-600">
              Create, edit, and manage tree planting projects with detailed information and media.
            </p>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-lg text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaUsers className="text-2xl text-orange-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Organization Oversight</h3>
            <p className="text-gray-600">
              Manage partner organizations and ensure project compliance and quality standards.
            </p>
          </div>
        </div>

        {/* Project Management Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Project Management Dashboard
            </h2>
            <Link
              to="/app/admin/tree-projects"
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <FaPlus className="w-4 h-4" />
              <span>Open real desk</span>
            </Link>
          </div>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading projects...</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Project</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Location</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Trees Planted</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {projects.map((project) => (
                      <tr key={project.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            {project.image_url && (
                              <img 
                                src={project.image_url} 
                                alt={project.name}
                                className="w-12 h-12 rounded-lg object-cover"
                              />
                            )}
                            <div>
                              <h3 className="font-semibold text-gray-900">{project.name}</h3>
                              <p className="text-sm text-gray-600">{project.organization_name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center text-gray-600">
                            <FaMapMarkerAlt className="w-4 h-4 mr-2" />
                            <span className="text-sm">{project.city}, {project.country}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <FaTree className="w-4 h-4 text-green-600" />
                            <span className="font-semibold text-green-600">{project.trees_planted || 0}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                setSelectedProject(project);
                                setShowProjectDetails(true);
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <FaEye className="w-4 h-4" />
                            </button>
                            <button
                              className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                              title="Edit Project"
                            >
                              <FaEdit className="w-4 h-4" />
                            </button>
                            <button
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              title="Delete Project"
                            >
                              <FaTrash className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Admin Tools */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Project Analytics</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Projects</span>
                <span className="font-semibold text-gray-900">{projects.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Trees Planted</span>
                <span className="font-semibold text-green-600">
                  {projects.reduce((sum, project) => sum + (project.trees_planted || 0), 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Active Projects</span>
                <span className="font-semibold text-blue-600">{projects.length}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2">
                <FaChartBar className="w-4 h-4" />
                <span>View Analytics</span>
              </button>
              <button className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2">
                <FaPlus className="w-4 h-4" />
                <span>Add New Project</span>
              </button>
              <button className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center space-x-2">
                <FaUsers className="w-4 h-4" />
                <span>Manage Organizations</span>
              </button>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-xl p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Ready to Manage Projects?</h2>
          <p className="text-lg mb-6 opacity-90">
            Access the full admin dashboard to manage tree planting projects, 
            track progress, and ensure environmental impact.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white text-green-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors flex items-center justify-center">
              <FaCog className="mr-2" />
              Access Admin Dashboard
            </button>
            <button className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-green-600 transition-colors flex items-center justify-center">
              <FaChartBar className="mr-2" />
              View Analytics
            </button>
          </div>
        </div>

        {/* Project Details Modal */}
        {showProjectDetails && selectedProject && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">{selectedProject.name}</h2>
                  <button
                    onClick={() => setShowProjectDetails(false)}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ✕
                  </button>
                </div>
                
                {selectedProject.image_url && (
                  <img 
                    src={selectedProject.image_url} 
                    alt={selectedProject.name}
                    className="w-full h-64 object-cover rounded-lg mb-6"
                  />
                )}
                
                <div className="space-y-4">
                  <div className="flex items-center text-gray-600">
                    <FaMapMarkerAlt className="w-5 h-5 mr-2" />
                    <span>{selectedProject.city}, {selectedProject.country}</span>
                  </div>
                  
                  <div className="flex items-center text-gray-600">
                    <FaUsers className="w-5 h-5 mr-2" />
                    <span>{selectedProject.organization_name}</span>
                  </div>
                  
                  <p className="text-gray-700">{selectedProject.description}</p>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-1">Trees Planted</h4>
                      <p className="text-2xl font-bold text-green-600">{selectedProject.trees_planted || 0}</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-1">CO₂ Absorption</h4>
                      <p className="text-2xl font-bold text-blue-600">{selectedProject.co2_absorption_per_tree}kg/year</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TreeAdmin;

