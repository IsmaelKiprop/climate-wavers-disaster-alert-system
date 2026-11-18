import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaTree, FaMapMarkerAlt, FaUsers, FaDollarSign, FaCheckCircle, FaTimesCircle, FaEdit, FaTrash, FaPlus } from 'react-icons/fa';
import { endpoints } from '../utils/endpoints';
import { getAuthToken } from '../utils/factory';
import { apiUrl, mediaUrl } from '../config/env';
import { uploadFiles } from '../services/upload.service';
import TreeAnalyticsPanel from './TreeAnalyticsPanel';
import ScheduleClimateEventModal from './ScheduleClimateEventModal';
import {
  formatSpeciesList,
  normalizeTreeSpecies,
  serializeTreeSpecies,
  speciesInventoryValueUsd,
  speciesPlantedSum,
  speciesRemaining,
  speciesTargetSum,
} from '../utils/treeSpecies';

/** Keep only usable public image URLs (Cloudinary / https). Drop API-root stubs. */
function isUsableMediaUrl(value) {
  const url = String(value || "").trim();
  if (!url) return false;
  if (url === "/" || /onrender\.com\/?$/i.test(url)) return false;
  if (url.startsWith("blob:") || url.startsWith("data:")) return true;
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname || "";
      // Bare host with no real media path (e.g. https://api…/) is not an image.
      if (!path || path === "/") return false;
      return true;
    } catch {
      return false;
    }
  }
  // Relative media path
  return url.startsWith("/") && url.length > 2;
}

function sanitizeGallery(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item) => String(item || "").trim()).filter(isUsableMediaUrl);
}

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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [applying, setApplying] = useState(false);
  const [plantingDayProject, setPlantingDayProject] = useState(null);
  const [speciesDraft, setSpeciesDraft] = useState('');
  const [speciesQtyDraft, setSpeciesQtyDraft] = useState('');
  const [speciesPriceDraft, setSpeciesPriceDraft] = useState('');
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
    organization_logo: '',
    cover_image: '',
    gallery: []
  });

  const [uploading, setUploading] = useState({
    organization_logo: false,
    cover_image: false,
    gallery: false
  });

  const [isAdmin, setIsAdmin] = useState(false);
  /** Climate Wavers platform admin — only they can verify projects */
  const [canVerifyProjects, setCanVerifyProjects] = useState(false);
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

  const refreshTreeAdminMe = async (token) => {
    const meRes = await fetch(apiUrl(endpoints.treeAdminMe), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!meRes.ok) return null;
    const me = await meRes.json();
    setTreeAdminMe(me);
    setCanVerifyProjects(Boolean(me.can_verify_projects || me.is_platform_admin));
    const { setTreeAdminAccess } = await import('../utils/factory');
    setTreeAdminAccess(Boolean(me.has_tree_admin_access));
    return me;
  };

  /** Admin desk always loads only this org's projects (platform admins see all). */
  const deskProjectsUrl = () =>
    apiUrl(`${endpoints.tree_projects}?mine=true`);
  const deskStatsUrl = () =>
    apiUrl(`${endpoints.tree_projects_stats}?mine=true`);

  /** Queue pending org for Climate Wavers admin approval (idempotent). */
  const ensureTreeAdminApplication = async ({ silent = false } = {}) => {
    const token = getAuthToken();
    if (!token) {
      toast.error('Please log in first');
      return null;
    }
    setApplying(true);
    try {
      const res = await fetch(apiUrl(endpoints.treeAdminEnsure), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.detail || 'Could not submit Tree Admin application');
        return null;
      }
      if (!silent) {
        toast.success(
          data?.created
            ? 'Application submitted — waiting for Climate Wavers verification.'
            : data?.message || 'Application already on file.'
        );
      }
      const me = await refreshTreeAdminMe(token);
      if (me) {
        setIsAdmin(Boolean(me.has_tree_admin_access));
      }
      return data;
    } catch (err) {
      console.error(err);
      toast.error('Could not submit Tree Admin application');
      return null;
    } finally {
      setApplying(false);
    }
  };

  const checkAdminStatus = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(apiUrl(endpoints.user), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      let staff = false;
      if (response.ok) {
        const userData = await response.json();
        staff = Boolean(userData.is_staff || userData.is_superuser);
      }

      try {
        let me = await refreshTreeAdminMe(token);
        // Returning users with an account but no org → queue them for approval once.
        if (me && !me.has_tree_admin_access && !me.has_pending && !(me.memberships || []).length) {
          await ensureTreeAdminApplication({ silent: true });
          me = await refreshTreeAdminMe(token);
        }
        if (searchParams.get('apply') === '1') {
          await ensureTreeAdminApplication({ silent: false });
          const next = new URLSearchParams(searchParams);
          next.delete('apply');
          setSearchParams(next, { replace: true });
          me = await refreshTreeAdminMe(token);
        }
        setIsAdmin(staff || Boolean(me?.has_tree_admin_access));
        return;
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
          const response = await fetch(deskProjectsUrl(), {
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

      const response = await fetch(deskProjectsUrl(), {
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
          const response = await fetch(deskStatsUrl(), {
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

      const response = await fetch(deskStatsUrl(), {
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

      const speciesList = serializeTreeSpecies(formData.tree_species);
      if (speciesList.length === 0) {
        toast.error('Add at least one tree species supporters can gift');
        setLoading(false);
        return;
      }
      if (speciesList.some((s) => !s.target || s.target <= 0)) {
        toast.error('Set a seedling quantity for each species');
        setLoading(false);
        return;
      }

      const speciesSum = speciesTargetSum(speciesList);
      const targetTrees = Math.max(
        parseInt(formData.target_trees, 10) || 0,
        speciesSum
      );
      if (!targetTrees || targetTrees <= 0) {
        toast.error('Please enter a valid number of target trees');
        setLoading(false);
        return;
      }

      const speciesPrices = speciesList
        .map((s) => (s.price != null ? Number(s.price) : null))
        .filter((n) => n != null && Number.isFinite(n) && n >= 0);
      const allSpeciesPriced =
        speciesList.length > 0 && speciesPrices.length === speciesList.length;
      let resolvedTreePrice = parseFloat(formData.tree_price);
      if (!Number.isFinite(resolvedTreePrice) || resolvedTreePrice < 0) {
        if (allSpeciesPriced) {
          // Default unused at checkout — store the lowest species price as fallback.
          resolvedTreePrice = Math.min(...speciesPrices);
        } else {
          toast.error(
            'Set a default tree price, or give every species its own USD price'
          );
          setLoading(false);
          return;
        }
      }

      const cover = isUsableMediaUrl(formData.cover_image)
        ? String(formData.cover_image).trim()
        : "";
      const logo = isUsableMediaUrl(formData.organization_logo)
        ? String(formData.organization_logo).trim()
        : "";
      const gallery = sanitizeGallery(formData.gallery);

      // Writable project fields only (avoid nested/read-only noise from edit hydrate).
      // tree_price is sent for PUT shape; backend ignores changes on verified projects for Tree Admins.
      const dataToSend = {
        name: formData.name,
        description: formData.description,
        short_description: formData.short_description || "",
        organization_name: formData.organization_name,
        organization_description: formData.organization_description || "",
        organization_website: formData.organization_website || null,
        organization_logo: logo || null,
        country: formData.country,
        region: formData.region,
        city: formData.city,
        latitude: formData.latitude === "" ? null : formData.latitude,
        longitude: formData.longitude === "" ? null : formData.longitude,
        address: formData.address || "",
        project_type: formData.project_type,
        target_trees: targetTrees,
        tree_species: speciesList,
        tree_price: Number(resolvedTreePrice.toFixed(2)),
        co2_absorption_per_tree: parseFloat(formData.co2_absorption_per_tree) || 22.0,
        biodiversity_impact: formData.biodiversity_impact || "",
        soil_improvement: formData.soil_improvement || "",
        water_conservation: formData.water_conservation || "",
        cover_image: cover || null,
        gallery,
        start_date: formData.start_date,
        expected_completion: formData.expected_completion,
        // Keep funding goal aligned with species inventory × prices when unset.
        total_budget: (() => {
          const entered = parseFloat(formData.total_budget);
          if (Number.isFinite(entered) && entered > 0) return entered;
          return speciesInventoryValueUsd(speciesList, resolvedTreePrice);
        })(),
        funding_goal: (() => {
          const entered = parseFloat(formData.funding_goal);
          if (Number.isFinite(entered) && entered > 0) return entered;
          return speciesInventoryValueUsd(speciesList, resolvedTreePrice);
        })(),
        contact_person: formData.contact_person || "",
        contact_email: formData.contact_email || "",
        contact_phone: formData.contact_phone || "",
        facebook_url: formData.facebook_url || null,
        twitter_url: formData.twitter_url || null,
        instagram_url: formData.instagram_url || null,
        linkedin_url: formData.linkedin_url || null,
      };

      // Empty optional URL fields → null (URLField rejects "").
      ["organization_website", "facebook_url", "twitter_url", "instagram_url", "linkedin_url"].forEach(
        (key) => {
          if (dataToSend[key] === "" || dataToSend[key] == null) {
            dataToSend[key] = null;
          }
        }
      );

      const token = getAuthToken();
      if (!token) {
        toast.error('Please log in to access this page');
        setLoading(false);
        return;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSend)
      });

      if (response.ok) {
        toast.success(editingProject ? 'Project updated successfully!' : 'Project created successfully!');
        setShowCreateForm(false);
        setEditingProject(null);
        resetForm();
        fetchProjects();
      } else {
        let message = 'Failed to save project';
        try {
          const error = await response.json();
          if (typeof error?.detail === 'string') {
            message = error.detail;
          } else if (error && typeof error === 'object') {
            const first = Object.entries(error)[0];
            if (first) {
              const [field, msgs] = first;
              const text = Array.isArray(msgs) ? msgs[0] : String(msgs);
              message = `${field}: ${text}`;
            }
          }
        } catch {
          // keep default
        }
        toast.error(message);
      }
    } catch (error) {
      toast.error('Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  const addTreeSpecies = () => {
    const name = String(speciesDraft || '').trim();
    const target = parseInt(String(speciesQtyDraft || '').replace(/,/g, ''), 10);
    const priceRaw = String(speciesPriceDraft || '').trim();
    const price = priceRaw === '' ? null : Number(priceRaw);
    if (!name) {
      toast.error('Enter a species name');
      return;
    }
    if (!target || target <= 0) {
      toast.error('Enter how many seedlings for this species');
      return;
    }
    if (priceRaw !== '' && (!Number.isFinite(price) || price < 0)) {
      toast.error('Enter a valid USD price for this species (or leave blank)');
      return;
    }
    const existing = normalizeTreeSpecies(formData.tree_species);
    if (existing.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      toast.error('That species is already on this project');
      return;
    }
    const next = [
      ...existing,
      {
        name,
        target,
        planted: 0,
        price: priceRaw === '' ? null : Number(price.toFixed(2)),
      },
    ];
    const sum = speciesTargetSum(next);
    setFormData((prev) => ({
      ...prev,
      tree_species: next,
      target_trees: Math.max(parseInt(prev.target_trees, 10) || 0, sum),
    }));
    setSpeciesDraft('');
    setSpeciesQtyDraft('');
    setSpeciesPriceDraft('');
  };

  const updateSpeciesTarget = (index, value) => {
    const target = Math.max(0, parseInt(String(value || '').replace(/,/g, ''), 10) || 0);
    setFormData((prev) => {
      const next = normalizeTreeSpecies(prev.tree_species).map((s, i) =>
        i === index ? { ...s, target } : s
      );
      const sum = speciesTargetSum(next);
      return {
        ...prev,
        tree_species: next,
        target_trees: Math.max(parseInt(prev.target_trees, 10) || 0, sum),
      };
    });
  };

  const updateSpeciesPrice = (index, value) => {
    const raw = String(value || '').trim();
    const price =
      raw === ''
        ? null
        : Number.isFinite(Number(raw)) && Number(raw) >= 0
          ? Number(Number(raw).toFixed(2))
          : null;
    setFormData((prev) => {
      const next = normalizeTreeSpecies(prev.tree_species).map((s, i) =>
        i === index ? { ...s, price } : s
      );
      return { ...prev, tree_species: next };
    });
  };

  const removeTreeSpecies = (index) => {
    setFormData((prev) => {
      const next = normalizeTreeSpecies(prev.tree_species).filter((_, i) => i !== index);
      const sum = speciesTargetSum(next);
      return {
        ...prev,
        tree_species: next,
        target_trees: sum > 0 ? sum : prev.target_trees,
      };
    });
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setSpeciesDraft('');
    setSpeciesQtyDraft('');
    setSpeciesPriceDraft('');
    const species = normalizeTreeSpecies(project.tree_species);
    const sum = speciesTargetSum(species);
    setFormData({
      ...project,
      tree_species: species,
      target_trees: Math.max(parseInt(project.target_trees, 10) || 0, sum) || project.target_trees,
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
      organization_logo: '',
      cover_image: '',
      gallery: []
    });
    setSpeciesDraft('');
    setSpeciesQtyDraft('');
    setSpeciesPriceDraft('');
    setUploading({
      organization_logo: false,
      cover_image: false,
      gallery: false
    });
  };

  const handleFileUpload = async (field, file) => {
    if (!file) return;

    setUploading((prev) => ({ ...prev, [field]: true }));

    try {
      // Cloudinary (same as posts/groups) — Render /media/ is not publicly durable.
      const urls = await uploadFiles(file);
      const fileUrl = urls?.[0];
      if (!fileUrl) throw new Error("Upload returned no URL");

      setFormData((prev) => ({
        ...prev,
        [field]: field === "gallery" ? [...(prev.gallery || []), fileUrl] : fileUrl,
      }));

      toast.success(`${field.replace(/_/g, " ")} uploaded`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(`Failed to upload ${field.replace(/_/g, " ")}. Try again.`);
    } finally {
      setUploading((prev) => ({ ...prev, [field]: false }));
    }
  };

  const handleFileChange = (field, file) => {
    if (file) {
      handleFileUpload(field, file);
    }
  };

  const handleMultipleFileUpload = async (files) => {
    if (!files || files.length === 0) return;

    setUploading((prev) => ({ ...prev, gallery: true }));

    try {
      const urls = await uploadFiles(Array.from(files));
      if (!urls.length) throw new Error("Upload returned no URLs");

      setFormData((prev) => ({
        ...prev,
        gallery: [...(prev.gallery || []), ...urls],
      }));

      toast.success(`${urls.length} image${urls.length === 1 ? "" : "s"} uploaded`);
    } catch (error) {
      console.error("Gallery upload error:", error);
      toast.error("Failed to upload gallery images. Try again.");
    } finally {
      setUploading((prev) => ({ ...prev, gallery: false }));
    }
  };

  const removeGalleryItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      gallery: (prev.gallery || []).filter((_, i) => i !== index),
    }));
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
                Manage your organization&apos;s projects and funding. Climate Wavers
                verifies projects before they go public — you cannot self-approve.
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
                <p className="mt-2 text-amber-700 dark:text-amber-400">
                  Application pending. Climate Wavers will approve you in admin
                  (Tree admin organizations). Publishing unlocks after approval.
                </p>
              ) : null}
            </div>
          ) : !isAdmin ? (
            <div className="mt-4 border border-border bg-background p-3 sm:p-4 text-sm space-y-3">
              <p className="text-muted">
                You’re signed in but not a verified Tree Admin yet. Submit once —
                your org appears in ClimateWavers Portal for approval.
              </p>
              <button
                type="button"
                disabled={applying}
                onClick={() => ensureTreeAdminApplication({ silent: false })}
                className="h-10 px-4 bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
              >
                {applying ? "Submitting…" : "Submit Tree Admin application"}
              </button>
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
                       {isUsableMediaUrl(formData.organization_logo) ? (
                         <div className="mt-2">
                           <p className="text-sm text-muted mb-1">Preview:</p>
                           <img
                             src={mediaUrl(formData.organization_logo)}
                             alt="Organization logo"
                             className="w-20 h-20 object-cover border border-border bg-background"
                             onError={(e) => {
                               e.currentTarget.src = "/avatar.png";
                             }}
                           />
                         </div>
                       ) : formData.organization_logo ? (
                         <p className="mt-2 text-xs text-muted">
                           Paste a full image URL (https://…) or upload a file.
                         </p>
                       ) : null}
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
                          Default tree price (USD)
                          {normalizeTreeSpecies(formData.tree_species).length >
                            0 &&
                          normalizeTreeSpecies(formData.tree_species).every(
                            (s) => s.price != null
                          )
                            ? ""
                            : " *"}
                        </label>
                        <input
                          type="number"
                          name="tree_price"
                          value={formData.tree_price}
                          onChange={handleInputChange}
                          step="0.01"
                          min="0"
                          placeholder={
                            normalizeTreeSpecies(formData.tree_species).every(
                              (s) => s.price != null
                            ) &&
                            normalizeTreeSpecies(formData.tree_species).length >
                              0
                              ? `Optional — e.g. ${Math.min(
                                  ...normalizeTreeSpecies(
                                    formData.tree_species
                                  ).map((s) => Number(s.price))
                                ).toFixed(2)}`
                              : "e.g. 2.00"
                          }
                          className={`${fieldClass} ${
                            editingProject?.is_verified && !canVerifyProjects
                              ? "opacity-70 cursor-not-allowed"
                              : ""
                          }`}
                          required={
                            !(
                              editingProject?.is_verified && !canVerifyProjects
                            ) &&
                            !(
                              normalizeTreeSpecies(formData.tree_species)
                                .length > 0 &&
                              normalizeTreeSpecies(formData.tree_species).every(
                                (s) => s.price != null
                              )
                            )
                          }
                          disabled={
                            Boolean(editingProject?.is_verified) &&
                            !canVerifyProjects
                          }
                          readOnly={
                            Boolean(editingProject?.is_verified) &&
                            !canVerifyProjects
                          }
                        />
                        <p className="text-xs text-muted mt-1.5">
                          Optional if every species below has its own USD price
                          (yours do). Used only as a fallback for unpriced
                          species.
                        </p>
                        {editingProject?.is_verified && !canVerifyProjects ? (
                          <p className="text-xs text-muted mt-1.5">
                            Default pricing is locked after project approval.
                            Contact Climate Wavers to change it.
                          </p>
                        ) : null}
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

                    <div className="mt-6">
                      <label className={labelClass}>
                        Tree species, prices & seedling targets *
                      </label>
                      <p className="text-xs text-muted mb-2">
                        Add each species with its seedling count and optional USD
                        price (e.g. Mangifera indica $2.31, Avocado $1.92). Leave
                        price blank to use the default tree price. Gifts decrement
                        remaining inventory automatically.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={speciesDraft}
                          onChange={(e) => setSpeciesDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addTreeSpecies();
                            }
                          }}
                          placeholder="Species name (e.g. Mangifera indica)"
                          className={`${fieldClass} sm:flex-1`}
                        />
                        <input
                          type="number"
                          min="1"
                          value={speciesQtyDraft}
                          onChange={(e) => setSpeciesQtyDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addTreeSpecies();
                            }
                          }}
                          placeholder="Seedlings"
                          className={`${fieldClass} sm:w-28`}
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={speciesPriceDraft}
                          onChange={(e) => setSpeciesPriceDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addTreeSpecies();
                            }
                          }}
                          placeholder="USD $"
                          className={`${fieldClass} sm:w-28`}
                          title="Optional — leave blank to use default tree price"
                        />
                        <button
                          type="button"
                          onClick={addTreeSpecies}
                          className="h-11 px-4 border border-border bg-background text-foreground text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-[var(--cw-overlay-soft)] shrink-0"
                        >
                          <FaPlus className="text-xs" />
                          Add species
                        </button>
                      </div>
                      {normalizeTreeSpecies(formData.tree_species).length > 0 ? (
                        <ul className="mt-3 space-y-2">
                          {normalizeTreeSpecies(formData.tree_species).map((species, index) => {
                            const rem = speciesRemaining(species);
                            const fallback = Number(formData.tree_price) || 0;
                            return (
                            <li
                              key={`${species.name}-${index}`}
                              className="border border-border bg-background p-3 flex flex-col gap-2"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium text-foreground truncate block">
                                    {species.name}
                                  </span>
                                  <span className="text-xs text-muted">
                                    {(species.planted || 0).toLocaleString()} planted
                                    {rem != null
                                      ? ` · ${rem.toLocaleString()} remaining`
                                      : ''}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <label className="text-xs text-muted shrink-0">Target</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={species.target || ''}
                                    onChange={(e) => updateSpeciesTarget(index, e.target.value)}
                                    className="h-9 w-24 px-2 border border-border bg-surface text-sm text-foreground"
                                  />
                                  <label className="text-xs text-muted shrink-0">USD</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={species.price != null ? species.price : ''}
                                    onChange={(e) => updateSpeciesPrice(index, e.target.value)}
                                    placeholder={fallback ? String(fallback) : '0'}
                                    className="h-9 w-24 px-2 border border-border bg-surface text-sm text-foreground"
                                    title="Blank = use default project price"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeTreeSpecies(index)}
                                    className="h-9 w-9 inline-flex items-center justify-center text-muted hover:text-foreground border border-border"
                                    aria-label={`Remove ${species.name}`}
                                    disabled={(species.planted || 0) > 0}
                                    title={
                                      (species.planted || 0) > 0
                                        ? 'Cannot remove — seedlings already gifted'
                                        : 'Remove species'
                                    }
                                  >
                                    <FaTimesCircle />
                                  </button>
                                </div>
                              </div>
                              <p className="text-[11px] text-muted">
                                {species.price != null
                                  ? `Checkout price: $${Number(species.price).toFixed(2)} / tree`
                                  : `Uses default: $${Number(fallback).toFixed(2)} / tree`}
                              </p>
                            </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                          No species yet — add at least one with a seedling count.
                        </p>
                      )}
                      {speciesTargetSum(formData.tree_species) > 0 ? (
                        <p className="mt-2 text-xs text-muted">
                          Inventory:{' '}
                          {speciesPlantedSum(formData.tree_species).toLocaleString()} /{' '}
                          {speciesTargetSum(formData.tree_species).toLocaleString()}{' '}
                          seedlings gifted
                        </p>
                      ) : null}
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
                       {isUsableMediaUrl(formData.cover_image) ? (
                         <div className="mt-2">
                           <p className="text-sm text-muted mb-1">Preview:</p>
                           <img
                             src={mediaUrl(formData.cover_image)}
                             alt="Cover"
                             className="w-40 h-24 object-cover border border-border bg-background"
                             onError={(e) => {
                               e.currentTarget.src = "/environment.jpg";
                             }}
                           />
                         </div>
                       ) : formData.cover_image ? (
                         <p className="mt-2 text-xs text-muted">
                           Paste a full image URL (https://…) or upload a file — bare API links won’t work.
                         </p>
                       ) : null}
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
                            const urls = e.target.value
                              .split('\n')
                              .map((url) => url.trim())
                              .filter(Boolean);
                            setFormData((prev) => ({
                              ...prev,
                              gallery: urls,
                            }));
                          }}
                          placeholder={"One https image URL per line\nhttps://res.cloudinary.com/.../image.jpg"}
                          rows="4"
                          className={fieldClass}
                        />
                        <p className="text-sm text-muted mt-1">
                          Prefer Upload files below — pasted links must be full https URLs.
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
                      </div>
                      {sanitizeGallery(formData.gallery).length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm text-muted mb-2">
                            Gallery ({sanitizeGallery(formData.gallery).length})
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {formData.gallery.map((url, index) => {
                              if (!isUsableMediaUrl(url)) return null;
                              const isVideo = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
                              const displayUrl = mediaUrl(url);
                              return (
                                <div key={`${url}-${index}`} className="relative border border-border bg-background">
                                  {isVideo ? (
                                    <video
                                      src={displayUrl}
                                      className="w-full h-24 object-cover"
                                      controls
                                    />
                                  ) : (
                                    <img
                                      src={displayUrl}
                                      alt={`Gallery ${index + 1}`}
                                      className="w-full h-24 object-cover"
                                      onError={(e) => {
                                        e.currentTarget.src = "/environment.jpg";
                                      }}
                                    />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => removeGalleryItem(index)}
                                    className="absolute top-1 right-1 h-7 px-2 text-xs bg-surface border border-border text-foreground"
                                  >
                                    Remove
                                  </button>
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
                          {normalizeTreeSpecies(project.tree_species).length > 0 ? (
                            <div
                              className="text-xs text-muted mt-0.5 max-w-[260px] truncate"
                              title={formatSpeciesList(project.tree_species, {
                                withRemaining: true,
                              })}
                            >
                              {formatSpeciesList(project.tree_species, {
                                withRemaining: true,
                                withPrice: true,
                                fallbackPrice: project.tree_price,
                              })}
                            </div>
                          ) : (
                            <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                              No species — edit to add
                            </div>
                          )}
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
                          onClick={() => setPlantingDayProject(project)}
                          className="h-9 px-2 text-xs font-medium text-primary hover:bg-background border border-transparent hover:border-border"
                          title="Schedule planting day"
                        >
                          Planting day
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(project)}
                          className="h-9 w-9 inline-flex items-center justify-center text-muted hover:text-foreground hover:bg-background border border-transparent hover:border-border"
                          title="Edit"
                        >
                          <FaEdit />
                        </button>
                        {!project.is_verified && canVerifyProjects && (
                          <button
                            type="button"
                            onClick={() => handleVerify(project.id)}
                            className="h-9 w-9 inline-flex items-center justify-center text-primary hover:bg-background border border-transparent hover:border-border"
                            title="Verify Project (Climate Wavers admin)"
                          >
                            <FaCheckCircle />
                          </button>
                        )}
                        {!project.is_verified && !canVerifyProjects && (
                          <span
                            className="h-9 w-9 inline-flex items-center justify-center text-muted/50 cursor-not-allowed"
                            title="Waiting for Climate Wavers to verify — you cannot approve your own projects"
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

      <ScheduleClimateEventModal
        open={Boolean(plantingDayProject)}
        onClose={() => setPlantingDayProject(null)}
        mode="project"
        projectId={plantingDayProject?.id}
        treeAdminOrgId={
          plantingDayProject?.tree_admin_org ||
          treeAdminMe?.memberships?.[0]?.org?.id ||
          null
        }
        defaultTitle={
          plantingDayProject ? `Planting day: ${plantingDayProject.name}` : ""
        }
        defaultDescription={
          plantingDayProject?.short_description ||
          plantingDayProject?.description ||
          ""
        }
        onCreated={(ev) => {
          setPlantingDayProject(null);
          navigate(`/app/calendar/events/${ev.id}`);
        }}
      />
    </div>
  );
};

export default TreeProjectAdmin;
