import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FaTree, FaMapMarkerAlt, FaUsers, FaDollarSign, FaCheckCircle, FaTimesCircle, FaEdit, FaTrash, FaPlus } from 'react-icons/fa';
import { endpoints } from '../utils/endpoints';
import { getAuthToken } from '../utils/factory';
import { apiUrl, mediaUrl } from '../config/env';

// Helper function to get cookies
const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
};

const TreeProjectAdmin = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [stats, setStats] = useState({
    total_projects: 0,
    active_projects: 0,
    verified_projects: 0,
    total_trees_planted: 0,
    total_funds_raised: 0
  });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    short_description: '',
    organization_name: '',
    organization_description: '',
    organization_website: '',
    country: '',
    region: '',
    city: '',
    latitude: '',
    longitude: '',
    address: '',
    project_type: '',
    target_trees: '',
    tree_species: [],
    tree_price: '',
    co2_absorption_per_tree: 22.0,
    biodiversity_impact: '',
    soil_improvement: '',
    water_conservation: '',
    start_date: '',
    expected_completion: '',
    total_budget: '',
    funding_goal: '',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    facebook_url: '',
    twitter_url: '',
    instagram_url: '',
    linkedin_url: '',
    gallery: []
  });

  const [uploading, setUploading] = useState({
    organization_logo: false,
    cover_image: false,
    gallery: false
  });

  const [uploadedUrls, setUploadedUrls] = useState({
    organization_logo: null,
    cover_image: null,
    gallery: []
  });

  const [isAdmin, setIsAdmin] = useState(false);
  const [treeAdminMe, setTreeAdminMe] = useState(null);

  // Debug admin status
  useEffect(() => {
    console.log('Admin status changed:', isAdmin);
  }, [isAdmin]);

  const projectTypes = [
    { value: 'reforestation', label: 'Reforestation' },
    { value: 'urban_greening', label: 'Urban Greening' },
    { value: 'agroforestry', label: 'Agroforestry' },
    { value: 'mangrove_restoration', label: 'Mangrove Restoration' },
    { value: 'community_garden', label: 'Community Garden' },
    { value: 'school_garden', label: 'School Garden' },
    { value: 'carbon_offset', label: 'Carbon Offset' }
  ];

  const africanCountries = [
    'Nigeria', 'Kenya', 'Ghana', 'South Africa', 'Tanzania', 'Uganda',
    'Ethiopia', 'Morocco', 'Algeria', 'Sudan', 'Angola', 'Mozambique',
    'Madagascar', 'Cameroon', 'Niger', 'Burkina Faso', 'Mali', 'Malawi',
    'Zambia', 'Somalia', 'Senegal', 'Chad', 'Sierra Leone', 'Libya',
    'Liberia', 'Central African Republic', 'Mauritania', 'Eritrea',
    'Gambia', 'Botswana', 'Gabon', 'Lesotho', 'Guinea-Bissau',
    'Equatorial Guinea', 'Mauritius', 'Eswatini', 'Djibouti',
    'Comoros', 'Cape Verde', 'São Tomé and Príncipe', 'Seychelles'
  ];

  useEffect(() => {
    // Debug: Check what cookies are available
    console.log('Admin Dashboard - All cookies:', document.cookie);
    console.log('Admin Dashboard - Access token from cookies:', getAuthToken());
    console.log('Admin Dashboard - localStorage token:', localStorage.getItem('token'));
    
    fetchProjects();
    fetchStats();
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      // Use the auth user endpoint to get current user data
      const response = await fetch(apiUrl(endpoints.user), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      let staff = false;
      if (response.ok) {
        const userData = await response.json();
        console.log('User data from API:', userData);
        console.log('is_staff:', userData.is_staff);
        console.log('is_superuser:', userData.is_superuser);
        staff = Boolean(userData.is_staff || userData.is_superuser);
      } else {
        console.error('Failed to fetch user data:', response.status);
      }

      try {
        const meRes = await fetch(apiUrl(endpoints.treeAdminMe), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meRes.ok) {
          const me = await meRes.json();
          setTreeAdminMe(me);
          const { setTreeAdminAccess } = await import('../utils/factory');
          setTreeAdminAccess(Boolean(me.has_tree_admin_access));
          setIsAdmin(staff || Boolean(me.has_tree_admin_access));
          return;
        }
      } catch (meErr) {
        console.error('Tree admin me failed:', meErr);
      }
      setIsAdmin(staff);
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const token = getAuthToken();
      console.log('Admin Dashboard - Token found:', !!token);
      console.log('Admin Dashboard - Token value:', token ? 'Present' : 'Not found');
      
      if (!token) {
        console.log('Admin Dashboard - No token found, checking localStorage...');
        const localToken = localStorage.getItem('token');
        console.log('Admin Dashboard - localStorage token:', localToken ? 'Present' : 'Not found');
        
        if (localToken) {
          console.log('Admin Dashboard - Using localStorage token as fallback');
          // Use localStorage token as fallback
          const response = await fetch(apiUrl(endpoints.tree_projects), {
            headers: {
              'Authorization': `Bearer ${localToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            setProjects(data.results || data);
          } else if (response.status === 401) {
            toast.error('Session expired. Please log in again.');
            localStorage.removeItem('token');
            window.location.href = '/login';
          } else {
            toast.error('Failed to fetch projects');
            setProjects([]);
          }
          setLoading(false);
          return;
        }
        
        toast.error('Please log in to access this page');
        setLoading(false);
        return;
      }

      const response = await fetch(apiUrl(endpoints.tree_projects), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setProjects(data.results || data);
      } else if (response.status === 401) {
        toast.error('Session expired. Please log in again.');
        clearAuthCookies();
        window.location.href = '/login';
      } else {
        toast.error('Failed to fetch projects');
        setProjects([]);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to fetch projects');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = getAuthToken();
      console.log('Admin Dashboard Stats - Token found:', !!token);
      
      if (!token) {
        console.log('Admin Dashboard Stats - No token found, checking localStorage...');
        const localToken = localStorage.getItem('token');
        if (localToken) {
          console.log('Admin Dashboard Stats - Using localStorage token as fallback');
          const response = await fetch(apiUrl(endpoints.tree_projects_stats), {
            headers: {
              'Authorization': `Bearer ${localToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            setStats(data);
          }
          return;
        }
        return;
      }

      const response = await fetch(apiUrl(endpoints.tree_projects_stats), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else if (response.status === 401) {
        console.log('Session expired for stats');
      } else {
        console.error('Failed to fetch stats');
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = apiUrl(editingProject 
        ? `${endpoints.tree_projects}${editingProject.id}/`
        : endpoints.tree_projects);
      
      const method = editingProject ? 'PUT' : 'POST';
      
      // Basic validation for required fields
      if (!formData.name || !formData.description || !formData.organization_name) {
        toast.error('Please fill in all required fields (Name, Description, Organization Name)');
        setLoading(false);
        return;
      }

      if (!formData.target_trees || parseInt(formData.target_trees) <= 0) {
        toast.error('Please enter a valid number of target trees');
        setLoading(false);
        return;
      }

      // Prepare data for JSON submission (no file uploads)
      const dataToSend = {
        ...formData,
        tree_species: Array.isArray(formData.tree_species) ? formData.tree_species : [],
        gallery: Array.isArray(formData.gallery) ? formData.gallery : [],
        // Convert string numbers to actual numbers
        target_trees: parseInt(formData.target_trees) || 0,
        tree_price: parseFloat(formData.tree_price) || 0,
        total_budget: parseFloat(formData.total_budget) || 0,
        funding_goal: parseFloat(formData.funding_goal) || 0,
        trees_planted: parseInt(formData.trees_planted) || 0,
        funds_raised: parseFloat(formData.funds_raised) || 0,
        co2_absorption_per_tree: parseFloat(formData.co2_absorption_per_tree) || 22.0
      };

      
      const token = getAuthToken();
      if (!token) {
        toast.error('Please log in to access this page');
        setLoading(false);
        return;
      }

      console.log('Sending data:', dataToSend);
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSend)
      });
      
      console.log('Response status:', response.status);
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Error response:', errorData);
      }

      if (response.ok) {
        toast.success(editingProject ? 'Project updated successfully!' : 'Project created successfully!');
        setShowCreateForm(false);
        setEditingProject(null);
        resetForm();
        fetchProjects();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to save project');
      }
    } catch (error) {
      toast.error('Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setFormData({
      ...project,
      tree_species: project.tree_species || [],
      gallery: project.gallery || []
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;

    try {
      const token = getAuthToken();
      if (!token) {
        toast.error('Please log in to access this page');
        return;
      }

      const response = await fetch(apiUrl(`${endpoints.tree_projects}${projectId}/`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success('Project deleted successfully!');
        fetchProjects();
      } else {
        toast.error('Failed to delete project');
      }
    } catch (error) {
      toast.error('Failed to delete project');
    }
  };

  const handleVerify = async (projectId) => {
    if (!window.confirm('Are you sure you want to verify this project?')) return;

    try {
      const token = getAuthToken();
      if (!token) {
        toast.error('Please log in to access this page');
        return;
      }

      console.log('Verifying project:', projectId);
      console.log('API endpoint:', `${endpoints.tree_projects}${projectId}/verify/`);

      const response = await fetch(apiUrl(`${endpoints.tree_projects}${projectId}/verify/`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (response.ok) {
        const result = await response.json();
        console.log('Verification result:', result);
        toast.success('Project verified successfully!');
        fetchProjects();
      } else if (response.status === 403) {
        // Show sweet alert for permission denied
        alert(`
🌳 Project Verification Access Denied

You don't have permission to verify projects.

Only administrators can verify tree planting projects to ensure quality and authenticity.

If you believe this is an error, please contact the system administrator.

Thank you for your understanding! 🌱
        `);
      } else {
        const error = await response.json();
        console.error('Verification error:', error);
        toast.error(error.error || 'Failed to verify project');
      }
    } catch (error) {
      console.error('Verification exception:', error);
      toast.error('Failed to verify project');
    }
  };


  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      short_description: '',
      organization_name: '',
      organization_description: '',
      organization_website: '',
      country: '',
      region: '',
      city: '',
      latitude: '',
      longitude: '',
      address: '',
      project_type: '',
      target_trees: '',
      tree_species: [],
      tree_price: '',
      co2_absorption_per_tree: 22.0,
      biodiversity_impact: '',
      soil_improvement: '',
      water_conservation: '',
      start_date: '',
      expected_completion: '',
      total_budget: '',
      funding_goal: '',
      contact_person: '',
      contact_email: '',
      contact_phone: '',
      facebook_url: '',
      twitter_url: '',
      instagram_url: '',
      linkedin_url: '',
      gallery: []
    });
    // Reset upload states
    setUploading({
      organization_logo: false,
      cover_image: false,
      gallery: false
    });
    setUploadedUrls({
      organization_logo: null,
      cover_image: null,
      gallery: []
    });
  };

  const handleFileUpload = async (field, file) => {
    if (!file) return;

    setUploading(prev => ({ ...prev, [field]: true }));

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'tree-projects');

      // Upload to your media service
      const response = await fetch(apiUrl('/api/v1/upload/'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        const fileUrl = result.url || result.secure_url;
        
        // Convert relative URL to absolute URL for preview
        const absoluteUrl = mediaUrl(fileUrl);
        
        // Update form data with the uploaded URL
        setFormData(prev => ({
          ...prev,
          [field]: field === 'gallery' ? [...prev[field], fileUrl] : fileUrl
        }));

        // Update uploaded URLs state
        setUploadedUrls(prev => ({
          ...prev,
          [field]: field === 'gallery' ? [...prev[field], absoluteUrl] : absoluteUrl
        }));

        toast.success(`${field.replace('_', ' ')} uploaded successfully!`);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(`Failed to upload ${field.replace('_', ' ')}. Please try again.`);
    } finally {
      setUploading(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleFileChange = (field, file) => {
    if (file) {
      handleFileUpload(field, file);
    }
  };

  const handleMultipleFileUpload = async (files) => {
    if (!files || files.length === 0) return;

    setUploading(prev => ({ ...prev, gallery: true }));

    try {
      const uploadPromises = Array.from(files).map(file => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'tree-projects/gallery');

        return fetch(apiUrl('/api/v1/upload/'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`
          },
          body: formData
        }).then(response => {
          if (response.ok) {
            return response.json();
          }
          throw new Error('Upload failed');
        });
      });

      const results = await Promise.all(uploadPromises);
      const urls = results.map(result => result.url || result.secure_url);
      const absoluteUrls = urls.map(url => mediaUrl(url));

      // Update form data with all uploaded URLs
      setFormData(prev => ({
        ...prev,
        gallery: [...prev.gallery, ...urls]
      }));

      setUploadedUrls(prev => ({
        ...prev,
        gallery: [...prev.gallery, ...absoluteUrls]
      }));

      toast.success(`${urls.length} images uploaded successfully!`);
    } catch (error) {
      console.error('Gallery upload error:', error);
      toast.error('Failed to upload gallery images. Please try again.');
    } finally {
      setUploading(prev => ({ ...prev, gallery: false }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Tree Project Management</h1>
              <p className="text-gray-600">Manage tree planting projects across Africa</p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setEditingProject(null);
                setShowCreateForm(true);
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center"
            >
              <FaPlus className="mr-2" />
              Add Project
            </button>
          </div>
          {treeAdminMe?.memberships?.[0]?.org ? (
            <div className="mt-4 border border-border bg-white p-4 text-sm">
              <p className="font-medium text-gray-900">
                {treeAdminMe.memberships[0].org.name} ·{" "}
                {treeAdminMe.memberships[0].org.plan_label || treeAdminMe.memberships[0].org.plan}
              </p>
              <p className="mt-1 text-gray-600">
                Status: {treeAdminMe.memberships[0].org.verification_status}
                {treeAdminMe.memberships[0].org.plan_status
                  ? ` · ${treeAdminMe.memberships[0].org.plan_status}`
                  : ""}
                {treeAdminMe.memberships[0].org.plan_ends_at
                  ? ` · ends ${new Date(treeAdminMe.memberships[0].org.plan_ends_at).toLocaleDateString()}`
                  : ""}
              </p>
              <p className="mt-1 text-gray-500">
                Platform fee on tree purchases: 18%. Project funds receive 82%.
              </p>
              {!treeAdminMe.has_tree_admin_access && treeAdminMe.has_pending ? (
                <p className="mt-2 text-amber-700">
                  Your application is pending verification. You can browse but publishing unlocks after approval.
                </p>
              ) : null}
            </div>
          ) : !isAdmin ? (
            <div className="mt-4 border border-border bg-white p-4 text-sm">
              <p className="text-gray-700">
                No Tree Admin org yet.{" "}
                <a href="/tree-admins/apply" className="text-green-700 font-medium underline">
                  Apply to become a Tree Admin
                </a>
                .
              </p>
            </div>
          ) : null}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <FaTree className="text-2xl text-green-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Total Projects</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_projects}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <FaCheckCircle className="text-2xl text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Active Projects</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active_projects}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <FaUsers className="text-2xl text-purple-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Verified</p>
                <p className="text-2xl font-bold text-gray-900">{stats.verified_projects}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <FaTree className="text-2xl text-green-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Trees Planted</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_trees_planted?.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <FaDollarSign className="text-2xl text-yellow-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Funds Raised</p>
                <p className="text-2xl font-bold text-gray-900">${stats.total_funds_raised?.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Create/Edit Form Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editingProject ? 'Edit Project' : 'Create New Project'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setEditingProject(null);
                      resetForm();
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FaTimesCircle className="text-xl" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Basic Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Project Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Project Type *
                      </label>
                      <select
                        name="project_type"
                        value={formData.project_type}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        required
                      >
                        <option value="">Select Project Type</option>
                        {projectTypes.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description *
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows="4"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>

                  {/* Organization Information */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Organization Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Organization Name *
                        </label>
                        <input
                          type="text"
                          name="organization_name"
                          value={formData.organization_name}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Organization Website
                        </label>
                        <input
                          type="url"
                          name="organization_website"
                          value={formData.organization_website}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Organization Description
                      </label>
                      <textarea
                        name="organization_description"
                        value={formData.organization_description}
                        onChange={handleInputChange}
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    
                     <div className="mt-4">
                       <label className="block text-sm font-medium text-gray-700 mb-2">
                         Organization Logo
                       </label>
                       
                       {/* URL Input */}
                       <div className="mb-3">
                         <label className="block text-sm text-gray-600 mb-1">Or enter URL:</label>
                         <input
                           type="text"
                           name="organization_logo"
                           value={formData.organization_logo}
                           onChange={handleInputChange}
                           placeholder="https://example.com/logo.png or /media/path/to/image.jpg"
                           className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                         />
                       </div>

                       {/* File Upload */}
                       <div className="mb-3">
                         <label className="block text-sm text-gray-600 mb-1">Or upload file:</label>
                         <div className="flex items-center space-x-2">
                           <input
                             type="file"
                             accept="image/*,video/*"
                             onChange={(e) => handleFileChange('organization_logo', e.target.files[0])}
                             className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                             disabled={uploading.organization_logo}
                           />
                           {uploading.organization_logo && (
                             <div className="flex items-center text-blue-600">
                               <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                               Uploading...
                             </div>
                           )}
                         </div>
                       </div>
                       {formData.organization_logo && (
                         <div className="mt-2">
                           <p className="text-sm text-gray-600 mb-1">Preview:</p>
                           <div className="relative inline-block">
                             <img 
                               src={mediaUrl(formData.organization_logo)} 
                               alt="Organization Logo Preview" 
                               className="w-20 h-20 object-cover rounded-md border border-gray-300"
                               onError={(e) => {
                                 e.target.style.display = 'none';
                                 e.target.nextSibling.style.display = 'block';
                               }}
                             />
                             <div className="absolute inset-0 bg-red-100 border border-red-300 rounded-md flex items-center justify-center text-red-600 text-xs hidden">
                               Invalid URL
                             </div>
                           </div>
                         </div>
                       )}
                     </div>
                  </div>

                  {/* Location Information */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Location Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Country *
                        </label>
                        <select
                          name="country"
                          value={formData.country}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          required
                        >
                          <option value="">Select Country</option>
                          {africanCountries.map(country => (
                            <option key={country} value={country}>
                              {country}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Region *
                        </label>
                        <input
                          type="text"
                          name="region"
                          value={formData.region}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          City *
                        </label>
                        <input
                          type="text"
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Project Details */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Target Trees *
                        </label>
                        <input
                          type="number"
                          name="target_trees"
                          value={formData.target_trees}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Tree Price ($) *
                        </label>
                        <input
                          type="number"
                          name="tree_price"
                          value={formData.tree_price}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          CO₂ Absorption (kg/year)
                        </label>
                        <input
                          type="number"
                          name="co2_absorption_per_tree"
                          value={formData.co2_absorption_per_tree}
                          onChange={handleInputChange}
                          step="0.1"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                    
                     <div className="mt-4">
                       <label className="block text-sm font-medium text-gray-700 mb-2">
                         Project Cover Image
                       </label>
                       
                       {/* URL Input */}
                       <div className="mb-3">
                         <label className="block text-sm text-gray-600 mb-1">Or enter URL:</label>
                         <input
                           type="text"
                           name="cover_image"
                           value={formData.cover_image}
                           onChange={handleInputChange}
                           placeholder="https://example.com/cover.jpg or /media/path/to/image.jpg"
                           className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                         />
                       </div>

                       {/* File Upload */}
                       <div className="mb-3">
                         <label className="block text-sm text-gray-600 mb-1">Or upload file:</label>
                         <div className="flex items-center space-x-2">
                           <input
                             type="file"
                             accept="image/*,video/*"
                             onChange={(e) => handleFileChange('cover_image', e.target.files[0])}
                             className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                             disabled={uploading.cover_image}
                           />
                           {uploading.cover_image && (
                             <div className="flex items-center text-blue-600">
                               <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                               Uploading...
                             </div>
                           )}
                         </div>
                       </div>
                       {formData.cover_image && (
                         <div className="mt-2">
                           <p className="text-sm text-gray-600 mb-1">Preview:</p>
                           <div className="relative inline-block">
                             <img 
                               src={mediaUrl(formData.cover_image)} 
                               alt="Cover Image Preview" 
                               className="w-32 h-20 object-cover rounded-md border border-gray-300"
                               onError={(e) => {
                                 e.target.style.display = 'none';
                                 e.target.nextSibling.style.display = 'block';
                               }}
                             />
                             <div className="absolute inset-0 bg-red-100 border border-red-300 rounded-md flex items-center justify-center text-red-600 text-xs hidden">
                               Invalid URL
                             </div>
                           </div>
                         </div>
                       )}
                     </div>
                  </div>

                  {/* Gallery */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Gallery</h3>
                    <div>
                      {/* URL Input */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Gallery URLs (Optional)
                        </label>
                        <textarea
                          name="gallery"
                          value={Array.isArray(formData.gallery) ? formData.gallery.join('\n') : ''}
                          onChange={(e) => {
                            const urls = e.target.value.split('\n').filter(url => url.trim());
                            setFormData(prev => ({
                              ...prev,
                              gallery: urls
                            }));
                          }}
                          placeholder="Enter image/video URLs, one per line:&#10;https://example.com/image1.jpg&#10;https://example.com/video1.mp4"
                          rows="4"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          Enter image/video URLs, one per line
                        </p>
                      </div>

                      {/* File Upload */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Or upload files:
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="file"
                            accept="image/*,video/*"
                            multiple
                            onChange={(e) => handleMultipleFileUpload(e.target.files)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                            disabled={uploading.gallery}
                          />
                          {uploading.gallery && (
                            <div className="flex items-center text-blue-600">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                              Uploading...
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Select multiple images or videos to upload
                        </p>
                      </div>
                      {formData.gallery && formData.gallery.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm text-gray-600 mb-2">Gallery Preview ({formData.gallery.length} items):</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {formData.gallery.map((url, index) => {
                              const isVideo = url.match(/\.(mp4|webm|ogg|avi|mov)$/i);
                              const displayUrl = mediaUrl(url);
                              return (
                                <div key={index} className="relative group">
                                  {isVideo ? (
                                    <video 
                                      src={displayUrl} 
                                      className="w-full h-24 object-cover rounded-md border border-gray-300 hover:shadow-md transition-shadow"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                      }}
                                      controls
                                    />
                                  ) : (
                                    <img 
                                      src={displayUrl} 
                                      alt={`Gallery ${index + 1}`}
                                      className="w-full h-24 object-cover rounded-md border border-gray-300 hover:shadow-md transition-shadow"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                      }}
                                    />
                                  )}
                                  <div className="absolute inset-0 bg-red-50 border border-red-200 rounded-md flex items-center justify-center text-red-500 text-xs hidden">
                                    <div className="text-center">
                                      <div className="text-red-400 mb-1">⚠️</div>
                                      <div>Invalid URL</div>
                                    </div>
                                  </div>
                                  <div className="absolute top-1 right-1 bg-black bg-opacity-50 text-white text-xs px-1 py-0.5 rounded text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    {index + 1}
                                  </div>
                                  <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs px-1 py-0.5 rounded text-center">
                                    {isVideo ? '🎥' : '🖼️'}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Timeline</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Start Date *
                        </label>
                        <input
                          type="date"
                          name="start_date"
                          value={formData.start_date}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Expected Completion *
                        </label>
                        <input
                          type="date"
                          name="expected_completion"
                          value={formData.expected_completion}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Contact Person *
                        </label>
                        <input
                          type="text"
                          name="contact_person"
                          value={formData.contact_person}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Contact Email *
                        </label>
                        <input
                          type="email"
                          name="contact_email"
                          value={formData.contact_email}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="flex justify-end space-x-4 pt-6 border-t">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        setEditingProject(null);
                        resetForm();
                      }}
                      className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : (editingProject ? 'Update Project' : 'Create Project')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Projects Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">All Projects</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cover Image
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Array.isArray(projects) && projects.map((project) => (
                  <tr key={project.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        {project.organization_logo_url && (
                          <img 
                            src={project.organization_logo_url} 
                            alt="Organization Logo" 
                            className="w-10 h-10 object-cover rounded-full border border-gray-200"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{project.name}</div>
                          <div className="text-sm text-gray-500">{project.organization_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FaMapMarkerAlt className="text-gray-400 mr-2" />
                        <div className="text-sm text-gray-900">
                          {project.city}, {project.country}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {project.cover_image_url ? (
                        <img 
                          src={project.cover_image_url} 
                          alt="Project Cover" 
                          className="w-16 h-12 object-cover rounded-md border border-gray-200"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                        />
                      ) : (
                        <div className="w-16 h-12 bg-gray-100 rounded-md border border-gray-200 flex items-center justify-center text-gray-400 text-xs">
                          No Image
                        </div>
                      )}
                      <div className="w-16 h-12 bg-red-50 border border-red-200 rounded-md flex items-center justify-center text-red-500 text-xs hidden">
                        Invalid
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {project.trees_planted} / {project.target_trees} trees
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${project.progress_percentage}%` }}
                        ></div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          project.status === 'active' ? 'bg-green-100 text-green-800' :
                          project.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          project.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {project.status}
                        </span>
                        {project.is_verified && (
                          <FaCheckCircle className="text-green-600" title="Verified" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(project)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <FaEdit />
                        </button>
                        {!project.is_verified && isAdmin && (
                          <button
                            onClick={() => handleVerify(project.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Verify Project"
                          >
                            <FaCheckCircle />
                          </button>
                        )}
                        {!project.is_verified && !isAdmin && (
                          <span
                            className="text-gray-400 cursor-not-allowed"
                            title="Only administrators can verify projects"
                          >
                            <FaCheckCircle />
                          </span>
                        )}
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!Array.isArray(projects) || projects.length === 0) && (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                      {loading ? 'Loading projects...' : 'No projects found. Create your first project!'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TreeProjectAdmin;
