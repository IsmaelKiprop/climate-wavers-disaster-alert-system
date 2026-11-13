import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FaTree, FaMapMarkerAlt, FaUsers, FaDollarSign, FaCheckCircle, FaTimesCircle, FaEdit, FaTrash, FaPlus } from 'react-icons/fa';
import { endpoints } from '../utils/endpoints';
import { getAuthToken } from '../utils/factory';
import { apiUrl, mediaUrl } from '../config/env';
import TreeAnalyticsPanel from './TreeAnalyticsPanel';

const fieldClass =
  'w-full h-11 px-3 border border-border bg-surface text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';
const labelClass = 'block text-sm font-medium text-foreground mb-1.5';
const sectionTitleClass = 'text-base font-semibold text-foreground mb-4';

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
      <div className="flex items-center justify-center min-h-[50vh] bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-border border-t-primary" />
      </div>
    );
  }

  const fundRaised = Number(stats.total_funds_raised) || 0;

  return (
    <div className="min-h-screen bg-background py-4 sm:py-6">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-5">
        {/* Header */}
        <div className="border border-border bg-surface p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted">Tree Admin</p>
              <h1 className="text-2xl sm:text-3xl font-semibold text-foreground mt-0.5">
                Tree Projects
              </h1>
              <p className="text-sm text-muted mt-1">
                Manage planting initiatives, track funding in USD, and publish verified projects.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setEditingProject(null);
                setShowCreateForm(true);
              }}
              className="h-11 px-4 bg-primary text-primary-foreground text-sm font-medium inline-flex items-center justify-center gap-2 shrink-0 hover:opacity-95"
            >
              <FaPlus className="text-sm" />
              New project
            </button>
          </div>
          {treeAdminMe?.memberships?.[0]?.org ? (
            <div className="mt-4 border border-border bg-background p-3 sm:p-4 text-sm">
              <p className="font-medium text-foreground">
                {treeAdminMe.memberships[0].org.name} ·{" "}
                {treeAdminMe.memberships[0].org.plan_label || treeAdminMe.memberships[0].org.plan}
              </p>
              <p className="mt-1 text-muted">
                Status: {treeAdminMe.memberships[0].org.verification_status}
                {treeAdminMe.memberships[0].org.plan_status
                  ? ` · ${treeAdminMe.memberships[0].org.plan_status}`
                  : ""}
                {treeAdminMe.memberships[0].org.plan_ends_at
                  ? ` · ends ${new Date(treeAdminMe.memberships[0].org.plan_ends_at).toLocaleDateString()}`
                  : ""}
              </p>
              <p className="mt-1 text-muted">
                Platform fee on tree purchases: 18%. Project funds receive 82%.
              </p>
              {!treeAdminMe.has_tree_admin_access && treeAdminMe.has_pending ? (
                <p className="mt-2 text-amber-600 dark:text-amber-400">
                  Your application is pending verification. You can browse but publishing unlocks after approval.
                </p>
              ) : null}
            </div>
          ) : !isAdmin ? (
            <div className="mt-4 border border-border bg-background p-3 sm:p-4 text-sm">
              <p className="text-muted">
                No Tree Admin org yet.{" "}
                <a href="/tree-admins/apply" className="text-primary font-medium underline">
                  Apply to become a Tree Admin
                </a>
                .
              </p>
            </div>
          ) : null}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Projects', value: stats.total_projects, icon: FaTree, tone: 'text-primary' },
            { label: 'Active', value: stats.active_projects, icon: FaCheckCircle, tone: 'text-primary' },
            { label: 'Verified', value: stats.verified_projects, icon: FaUsers, tone: 'text-primary' },
            {
              label: 'Trees planted',
              value: stats.total_trees_planted?.toLocaleString?.() ?? stats.total_trees_planted,
              icon: FaTree,
              tone: 'text-primary',
            },
            {
              label: 'Funds raised (USD)',
              value: `$${fundRaised.toLocaleString()}`,
              icon: FaDollarSign,
              tone: 'text-primary',
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="border border-border bg-surface p-4">
                <div className="flex items-start gap-3">
                  <Icon className={`text-lg mt-0.5 shrink-0 ${card.tone}`} />
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted">{card.label}</p>
                    <p className="text-xl sm:text-2xl font-semibold text-foreground mt-0.5 truncate">
                      {card.value ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <TreeAnalyticsPanel
          className="mb-1"
          variant="admin"
          projects={Array.isArray(projects) ? projects : []}
        />

        {/* Create/Edit Form Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/55">
            <div className="bg-surface border border-border w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-xl">
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-border bg-surface">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted">
                    {editingProject ? 'Edit' : 'Create'}
                  </p>
                  <h2 className="text-xl font-semibold text-foreground">
                    {editingProject ? 'Edit project' : 'Create new project'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingProject(null);
                    resetForm();
                  }}
                  className="h-10 w-10 inline-flex items-center justify-center text-muted hover:text-foreground hover:bg-background border border-transparent hover:border-border"
                  aria-label="Close"
                >
                  <FaTimesCircle className="text-lg" />
                </button>
              </div>

              <div className="p-4 sm:p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Basic Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                    <div>
                      <label className={labelClass}>Project Name *</label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className={fieldClass}
                        required
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Project Type *</label>
                      <select
                        name="project_type"
                        value={formData.project_type}
                        onChange={handleInputChange}
                        className={fieldClass}
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
                    <label className={labelClass}>Description *</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows="4"
                      className={`${fieldClass} h-auto py-2.5`}
                      required
                    />
                  </div>

                  {/* Organization Information */}
                  <div className="border-t border-border pt-6">
                    <h3 className={sectionTitleClass}>Organization Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                      <div>
                        <label className={labelClass}>Organization Name *</label>
                        <input
                          type="text"
                          name="organization_name"
                          value={formData.organization_name}
                          onChange={handleInputChange}
                          className={fieldClass}
                          required
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Organization Website</label>
                        <input
                          type="url"
                          name="organization_website"
                          value={formData.organization_website}
                          onChange={handleInputChange}
                          className={fieldClass}
                        />
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <label className={labelClass}>Organization Description</label>
                      <textarea
                        name="organization_description"
                        value={formData.organization_description}
                        onChange={handleInputChange}
                        rows="3"
                        className={`${fieldClass} h-auto py-2.5`}
                      />
                    </div>
                    
                     <div className="mt-4">
                       <label className={labelClass}>
                         Organization Logo
                       </label>
                       
                       {/* URL Input */}
                       <div className="mb-3">
                         <label className="block text-sm text-muted mb-1">Or enter URL:</label>
                         <input
                           type="text"
                           name="organization_logo"
                           value={formData.organization_logo}
                           onChange={handleInputChange}
                           placeholder="https://example.com/logo.png or /media/path/to/image.jpg"
                           className={fieldClass}
                         />
                       </div>

                       {/* File Upload */}
                       <div className="mb-3">
                         <label className="block text-sm text-muted mb-1">Or upload file:</label>
                         <div className="flex items-center space-x-2">
                           <input
                             type="file"
                             accept="image/*,video/*"
                             onChange={(e) => handleFileChange('organization_logo', e.target.files[0])}
                             className={`flex-1 ${fieldClass}`}
                             disabled={uploading.organization_logo}
                           />
                           {uploading.organization_logo && (
                             <div className="flex items-center text-primary">
                               <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                               Uploading...
                             </div>
                           )}
                         </div>
                       </div>
                       {formData.organization_logo && (
                         <div className="mt-2">
                           <p className="text-sm text-muted mb-1">Preview:</p>
                           <div className="relative inline-block">
                             <img 
                               src={mediaUrl(formData.organization_logo)} 
                               alt="Organization Logo Preview" 
                               className="w-20 h-20 object-cover rounded-md border border-border"
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
                  <div className="border-t border-border pt-6">
                    <h3 className={sectionTitleClass}>Location Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className={labelClass}>
                          Country *
                        </label>
                        <select
                          name="country"
                          value={formData.country}
                          onChange={handleInputChange}
                          className={fieldClass}
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
                        <label className={labelClass}>
                          Region *
                        </label>
                        <input
                          type="text"
                          name="region"
                          value={formData.region}
                          onChange={handleInputChange}
                          className={fieldClass}
                          required
                        />
                      </div>
                      <div>
                        <label className={labelClass}>
                          City *
                        </label>
                        <input
                          type="text"
                          name="city"
                          value={formData.city}
                          onChange={handleInputChange}
                          className={fieldClass}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Project Details */}
                  <div className="border-t border-border pt-6">
                    <h3 className={sectionTitleClass}>Project Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className={labelClass}>
                          Target Trees *
                        </label>
                        <input
                          type="number"
                          name="target_trees"
                          value={formData.target_trees}
                          onChange={handleInputChange}
                          className={fieldClass}
                          required
                        />
                      </div>
                      <div>
                        <label className={labelClass}>
                          Tree Price (USD) *
                        </label>
                        <input
                          type="number"
                          name="tree_price"
                          value={formData.tree_price}
                          onChange={handleInputChange}
                          className={fieldClass}
                          required
                        />
                      </div>
                      <div>
                        <label className={labelClass}>
                          CO₂ Absorption (kg/year)
                        </label>
                        <input
                          type="number"
                          name="co2_absorption_per_tree"
                          value={formData.co2_absorption_per_tree}
                          onChange={handleInputChange}
                          step="0.1"
                          className={fieldClass}
                        />
                      </div>
                    </div>
                    
                     <div className="mt-4">
                       <label className={labelClass}>
                         Project Cover Image
                       </label>
                       
                       {/* URL Input */}
                       <div className="mb-3">
                         <label className="block text-sm text-muted mb-1">Or enter URL:</label>
                         <input
                           type="text"
                           name="cover_image"
                           value={formData.cover_image}
                           onChange={handleInputChange}
                           placeholder="https://example.com/cover.jpg or /media/path/to/image.jpg"
                           className={fieldClass}
                         />
                       </div>

                       {/* File Upload */}
                       <div className="mb-3">
                         <label className="block text-sm text-muted mb-1">Or upload file:</label>
                         <div className="flex items-center space-x-2">
                           <input
                             type="file"
                             accept="image/*,video/*"
                             onChange={(e) => handleFileChange('cover_image', e.target.files[0])}
                             className={`flex-1 ${fieldClass}`}
                             disabled={uploading.cover_image}
                           />
                           {uploading.cover_image && (
                             <div className="flex items-center text-primary">
                               <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                               Uploading...
                             </div>
                           )}
                         </div>
                       </div>
                       {formData.cover_image && (
                         <div className="mt-2">
                           <p className="text-sm text-muted mb-1">Preview:</p>
                           <div className="relative inline-block">
                             <img 
                               src={mediaUrl(formData.cover_image)} 
                               alt="Cover Image Preview" 
                               className="w-32 h-20 object-cover rounded-md border border-border"
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
                  <div className="border-t border-border pt-6">
                    <h3 className={sectionTitleClass}>Project Gallery</h3>
                    <div>
                      {/* URL Input */}
                      <div className="mb-4">
                        <label className={labelClass}>
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
                          className={fieldClass}
                        />
                        <p className="text-sm text-muted mt-1">
                          Enter image/video URLs, one per line
                        </p>
                      </div>

                      {/* File Upload */}
                      <div className="mb-4">
                        <label className={labelClass}>
                          Or upload files:
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="file"
                            accept="image/*,video/*"
                            multiple
                            onChange={(e) => handleMultipleFileUpload(e.target.files)}
                            className={`flex-1 ${fieldClass}`}
                            disabled={uploading.gallery}
                          />
                          {uploading.gallery && (
                            <div className="flex items-center text-primary">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                              Uploading...
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-muted mt-1">
                          Select multiple images or videos to upload
                        </p>
                      </div>
                      {formData.gallery && formData.gallery.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm text-muted mb-2">Gallery Preview ({formData.gallery.length} items):</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {formData.gallery.map((url, index) => {
                              const isVideo = url.match(/\.(mp4|webm|ogg|avi|mov)$/i);
                              const displayUrl = mediaUrl(url);
                              return (
                                <div key={index} className="relative group">
                                  {isVideo ? (
                                    <video 
                                      src={displayUrl} 
                                      className="w-full h-24 object-cover rounded-md border border-border hover:shadow-md transition-shadow"
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
                                      className="w-full h-24 object-cover rounded-md border border-border hover:shadow-md transition-shadow"
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
                  <div className="border-t border-border pt-6">
                    <h3 className={sectionTitleClass}>Project Timeline</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className={labelClass}>
                          Start Date *
                        </label>
                        <input
                          type="date"
                          name="start_date"
                          value={formData.start_date}
                          onChange={handleInputChange}
                          className={fieldClass}
                          required
                        />
                      </div>
                      <div>
                        <label className={labelClass}>
                          Expected Completion *
                        </label>
                        <input
                          type="date"
                          name="expected_completion"
                          value={formData.expected_completion}
                          onChange={handleInputChange}
                          className={fieldClass}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="border-t border-border pt-6">
                    <h3 className={sectionTitleClass}>Contact Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className={labelClass}>
                          Contact Person *
                        </label>
                        <input
                          type="text"
                          name="contact_person"
                          value={formData.contact_person}
                          onChange={handleInputChange}
                          className={fieldClass}
                          required
                        />
                      </div>
                      <div>
                        <label className={labelClass}>
                          Contact Email *
                        </label>
                        <input
                          type="email"
                          name="contact_email"
                          value={formData.contact_email}
                          onChange={handleInputChange}
                          className={fieldClass}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-6 border-t border-border">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        setEditingProject(null);
                        resetForm();
                      }}
                      className="h-11 px-4 border border-border bg-surface text-foreground text-sm font-medium hover:bg-background"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="h-11 px-5 bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                    >
                      {loading ? 'Saving…' : (editingProject ? 'Update project' : 'Create project')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Projects */}
        <div className="border border-border bg-surface overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">All projects</h3>
              <p className="text-xs text-muted mt-0.5">
                {Array.isArray(projects) ? projects.length : 0} listed · prices in USD
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-background">
                <tr>
                  {['Project', 'Location', 'Cover', 'Progress', 'Status', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {Array.isArray(projects) && projects.map((project) => (
                  <tr key={project.id} className="hover:bg-background/60">
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        {project.organization_logo_url && (
                          <img 
                            src={project.organization_logo_url} 
                            alt="" 
                            className="w-10 h-10 object-cover rounded-full border border-border"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium text-foreground">{project.name}</div>
                          <div className="text-sm text-muted">{project.organization_name}</div>
                          {project.tree_price != null && project.tree_price !== '' ? (
                            <div className="text-xs text-muted mt-0.5">
                              ${Number(project.tree_price).toLocaleString()} / tree
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FaMapMarkerAlt className="text-muted mr-2 shrink-0" />
                        <div className="text-sm text-foreground">
                          {project.city}, {project.country}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      {project.cover_image_url ? (
                        <img 
                          src={project.cover_image_url} 
                          alt="" 
                          className="w-16 h-12 object-cover border border-border"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : (
                        <div className="w-16 h-12 bg-background border border-border flex items-center justify-center text-muted text-xs">
                          —
                        </div>
                      )}
                      <div className="w-16 h-12 border border-red-300 text-red-500 text-xs hidden items-center justify-center">
                        Invalid
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap min-w-[140px]">
                      <div className="text-sm text-foreground">
                        {project.trees_planted} / {project.target_trees} trees
                      </div>
                      <div className="w-full bg-background border border-border h-2 mt-1.5 overflow-hidden">
                        <div
                          className="bg-primary h-2"
                          style={{ width: `${Math.min(100, Number(project.progress_percentage) || 0)}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs border ${
                          project.status === 'active' ? 'border-primary/40 text-primary bg-primary/10' :
                          project.status === 'completed' ? 'border-border text-foreground bg-background' :
                          project.status === 'paused' ? 'border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10' :
                          'border-border text-muted bg-background'
                        }`}>
                          {project.status}
                        </span>
                        {project.is_verified && (
                          <FaCheckCircle className="text-primary" title="Verified" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(project)}
                          className="h-9 w-9 inline-flex items-center justify-center text-muted hover:text-foreground hover:bg-background border border-transparent hover:border-border"
                          title="Edit"
                        >
                          <FaEdit />
                        </button>
                        {!project.is_verified && isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleVerify(project.id)}
                            className="h-9 w-9 inline-flex items-center justify-center text-primary hover:bg-background border border-transparent hover:border-border"
                            title="Verify Project"
                          >
                            <FaCheckCircle />
                          </button>
                        )}
                        {!project.is_verified && !isAdmin && (
                          <span
                            className="h-9 w-9 inline-flex items-center justify-center text-muted/50 cursor-not-allowed"
                            title="Only administrators can verify projects"
                          >
                            <FaCheckCircle />
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(project.id)}
                          className="h-9 w-9 inline-flex items-center justify-center text-red-500 hover:bg-background border border-transparent hover:border-border"
                          title="Delete"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!Array.isArray(projects) || projects.length === 0) && (
                  <tr>
                    <td colSpan="6" className="px-6 py-14 text-center text-muted text-sm">
                      {loading ? 'Loading projects…' : 'No projects yet. Create your first project to populate analytics.'}
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
