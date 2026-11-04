import { useForm } from "react-hook-form";
import { useState, useRef, useEffect } from "react";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { getUser, getAuthToken, avatarUrl } from "../utils/factory";
import { uploadFiles } from "../services/upload.service";
import { 
  IoSend, 
  IoImageOutline, 
  IoMusicalNotesOutline, 
  IoHappyOutline, 
  IoLocationOutline,
  IoSparklesOutline,
  IoCloseOutline,
  IoCheckmarkCircleOutline,
  IoWarningOutline,
  IoVideocamOutline
} from "react-icons/io5";
import { toast } from "react-toastify";
import AuthStatus from "./AuthStatus";
import { env } from "../config/env";

const ModernPostCreator = ({ type = "post", postId, parentId, closeModal }) => {
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm();
  const [user, setUserState] = useState(() => getUser() || null);
  const [imagePreview, setImagePreview] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [isDisabled, setIsDisabled] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestedHashtags, setSuggestedHashtags] = useState([]);
  const [contentAnalysis, setContentAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationAddress, setLocationAddress] = useState(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const content = watch("content", "");

  useEffect(() => {
    const sync = () => setUserState(getUser() || null);
    sync();
    window.addEventListener("userUpdated", sync);
    return () => window.removeEventListener("userUpdated", sync);
  }, []);

  // Token validation helper
  const validateToken = () => {
    const token = getAuthToken();
    if (!token) {
      toast.error("Please log in to use AI features");
      return false;
    }
    return true;
  };

  // AI Content Generation
  const generateContent = async () => {
    setIsGenerating(true);
    
    // If no token, use fallback content
    if (!getAuthToken()) {
      const fallbackContent = "🌱 Let's take action for climate change! Every small step towards sustainability matters. Together, we can make a difference for our planet.";
      const fallbackHashtags = ["#ClimateAction", "#Sustainability", "#Environment", "#GreenLiving", "#EcoFriendly"];
      setValue('content', fallbackContent);
      setSuggestedHashtags(fallbackHashtags);
      toast.success("Fallback content generated!");
      setIsGenerating(false);
      return;
    }
    
    try {
      const token = getAuthToken();

      const response = await fetch(`${env.backendUrl}${endpoints.ai_generate_content}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          topic: 'climate action, sustainability, environment',
          type: 'social_media_post'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setValue('content', data.content);
        setSuggestedHashtags(data.hashtags || []);
        toast.success("AI content generated!");
      } else if (response.status === 401) {
        toast.error("Authentication failed. Please log in again.");
        // Redirect to login or refresh token
        window.location.href = '/auth/signin';
      } else if (response.status === 503) {
        toast.error("AI service not configured. Using fallback content.");
        // Use fallback content
        const fallbackContent = "🌱 Let's take action for climate change! Every small step towards sustainability matters. Together, we can make a difference for our planet.";
        const fallbackHashtags = ["#ClimateAction", "#Sustainability", "#Environment", "#GreenLiving", "#EcoFriendly"];
        setValue('content', fallbackContent);
        setSuggestedHashtags(fallbackHashtags);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('AI generation error:', error);
      toast.error("AI service unavailable");
    } finally {
      setIsGenerating(false);
    }
  };

  // Content Analysis and Filtering
  const analyzeContent = async (text) => {
    if (!text || text.length < 10) return;
    
    setIsAnalyzing(true);
    try {
      const token = getAuthToken();
      if (!token) {
        // Use basic validation if no token
        const basicAnalysis = {
          is_appropriate: text.length >= 5 && !text.includes('http'),
          reason: text.length < 5 ? "Content is too short" : text.includes('http') ? "Links are not allowed" : "",
          climate_related: text.toLowerCase().includes('climate') || text.toLowerCase().includes('environment'),
          has_links: text.includes('http'),
          has_bad_words: false,
          suggestions: []
        };
        setContentAnalysis(basicAnalysis);
        setIsAnalyzing(false);
        return;
      }

      const response = await fetch(`${env.backendUrl}${endpoints.ai_analyze_content}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content: text })
      });
      
      if (response.ok) {
        const analysis = await response.json();
        setContentAnalysis(analysis);
      } else if (response.status === 401) {
        // Token invalid, use basic validation
        const basicAnalysis = {
          is_appropriate: text.length >= 5 && !text.includes('http'),
          reason: text.length < 5 ? "Content is too short" : text.includes('http') ? "Links are not allowed" : "",
          climate_related: text.toLowerCase().includes('climate') || text.toLowerCase().includes('environment'),
          has_links: text.includes('http'),
          has_bad_words: false,
          suggestions: []
        };
        setContentAnalysis(basicAnalysis);
      } else if (response.status === 503) {
        // AI service not available, use basic validation
        const basicAnalysis = {
          is_appropriate: text.length >= 5 && !text.includes('http'),
          reason: text.length < 5 ? "Content is too short" : text.includes('http') ? "Links are not allowed" : "",
          climate_related: text.toLowerCase().includes('climate') || text.toLowerCase().includes('environment'),
          has_links: text.includes('http'),
          has_bad_words: false,
          suggestions: []
        };
        setContentAnalysis(basicAnalysis);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Content analysis error:', error);
      // Use basic validation as fallback
      const basicAnalysis = {
        is_appropriate: text.length >= 5 && !text.includes('http'),
        reason: text.length < 5 ? "Content is too short" : text.includes('http') ? "Links are not allowed" : "",
        climate_related: text.toLowerCase().includes('climate') || text.toLowerCase().includes('environment'),
        has_links: text.includes('http'),
        has_bad_words: false,
        suggestions: []
      };
      setContentAnalysis(basicAnalysis);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Debounced content analysis
  useEffect(() => {
    const timer = setTimeout(() => {
      if (content && content.length > 10) {
        analyzeContent(content);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [content]);

  // Image handling
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    console.log("Image file selected:", file);
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error("Image size must be less than 5MB");
        return;
      }
      console.log("Image file details:", {
        name: file.name,
        type: file.type,
        size: file.size
      });
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Video handling
  const handleVideoChange = (e) => {
    const file = e.target.files[0];
    console.log("Video file selected:", file);
    if (file) {
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        toast.error("Video size must be less than 50MB");
        return;
      }
      console.log("Video file details:", {
        name: file.name,
        type: file.type,
        size: file.size
      });
      setVideoPreview(URL.createObjectURL(file));
      setImagePreview(null); // Clear image if video is selected
    }
  };

  const removeVideo = () => {
    setVideoPreview(null);
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  // Emoji picker functionality
  const addEmoji = (emoji) => {
    const currentContent = watch('content') || '';
    const newContent = currentContent + emoji;
    setValue('content', newContent);
    setShowEmojiPicker(false);
  };

  // Frontend reverse geocoding function
  const reverseGeocode = async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'ClimateWavers/1.0'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.display_name) {
          return data.display_name;
        } else if (data.address) {
          const address = data.address;
          const parts = [];
          if (address.city) parts.push(address.city);
          else if (address.town) parts.push(address.town);
          else if (address.village) parts.push(address.village);
          
          if (address.state) parts.push(address.state);
          if (address.country) parts.push(address.country);
          
          return parts.length > 0 ? parts.join(', ') : `${latitude}, ${longitude}`;
        }
      }
      return `${latitude}, ${longitude}`;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return `${latitude}, ${longitude}`;
    }
  };

  // Location functionality
  const handleLocationClick = async () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setSelectedLocation({ latitude, longitude });
          setValue('location', `${latitude}, ${longitude}`);
          setShowLocationPicker(false);
          
          // Get address from coordinates
          const address = await reverseGeocode(latitude, longitude);
          setLocationAddress(address);
          setValue('location', address); // Update with the address
          
          toast.success("Location added successfully!");
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error("Unable to get your location. Please try again.");
        }
      );
    } else {
      toast.error("Geolocation is not supported by this browser.");
    }
  };

  // Initialize location field with empty string
  useEffect(() => {
    setValue('location', '');
  }, [setValue]);

  // Common emojis for climate action
  const commonEmojis = [
    '🌱', '🌍', '🌿', '🌳', '🌊', '☀️', '💚', '♻️', '🌱', '🌿',
    '🌍', '🌳', '🌊', '☀️', '💚', '♻️', '🌱', '🌿', '🌍', '🌳'
  ];

  // Hashtag suggestions
  const addHashtag = (hashtag) => {
    const currentContent = watch('content') || '';
    const newContent = currentContent + (currentContent.endsWith(' ') ? '' : ' ') + hashtag;
    setValue('content', newContent);
  };

  // Form submission
  const onSubmit = async (data) => {
    console.log("Form submitted with data:", data);
    
    // Content validation
    if (!data.content || data.content.trim().length < 5) {
      toast.error("Please enter meaningful content (at least 5 characters)");
      return;
    }

    // Check content analysis
    if (contentAnalysis && !contentAnalysis.is_appropriate) {
      toast.error("Content doesn't meet platform guidelines");
      return;
    }

    setIsDisabled(true);
    
    try {
      // Create FormData for mixed file handling
      const formData = new FormData();
      
      // Debug: Log all form data
      console.log("Form data received:", data);
      console.log("Image data:", data.image);
      console.log("Video data:", data.video);
      console.log("Audio data:", data.audio);
      
      // Add text content
      formData.append('content', data.content);
      
      // Add location if available
      if (data.location) {
        formData.append('location', data.location);
      }
      
      // Add post/comment relationships
      if (postId) formData.append('post', postId);
      if (parentId) formData.append('parent_comment', parentId);
      
      // Handle image files - upload to Cloudinary and send URL
      if (data.image && data.image.length > 0 && data.image[0] instanceof File) {
        console.log("Uploading image file:", data.image[0].name, data.image[0].type, data.image[0].size);
        const imageUrl = await uploadFiles(data.image[0]);
        if (imageUrl && imageUrl.length > 0) {
          formData.append('image', imageUrl[0]);
          console.log("Image uploaded successfully:", imageUrl[0]);
        }
      }
      
      // Handle video files - upload to Cloudinary and send URL
      if (data.video && data.video.length > 0 && data.video[0] instanceof File) {
        console.log("Uploading video file:", data.video[0].name, data.video[0].type, data.video[0].size);
        const videoUrl = await uploadFiles(data.video[0]);
        if (videoUrl && videoUrl.length > 0) {
          formData.append('video', videoUrl[0]);
          console.log("Video uploaded successfully:", videoUrl[0]);
          console.log("Video URL added to FormData");
        } else {
          console.error("Video upload failed - no URL returned");
        }
      } else {
        console.log("No video file found. Video data:", data.video);
      }
      
      // Handle audio files - send as File object
      if (data.audio && data.audio.length > 0 && data.audio[0] instanceof File) {
        console.log("Adding audio file:", data.audio[0].name, data.audio[0].type, data.audio[0].size);
        formData.append('audio', data.audio[0]);
      }
      
      const endpoint = endpoints[type];
      console.log("Using endpoint:", endpoint);
      
      // Debug: Log FormData contents
      console.log("FormData contents:");
      for (let [key, value] of formData.entries()) {
        console.log(`${key}:`, value);
      }
      
      const token = getAuthToken();
      const response = await fetch(`${env.backendUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type, let browser set it with boundary for FormData
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      toast.success("Post created successfully! 🌱");
      
      reset();
      setImagePreview(null);
      setVideoPreview(null);
      setSuggestedHashtags([]);
      setContentAnalysis(null);
      setIsDisabled(false);
      
      if (closeModal) closeModal();
      
    } catch (error) {
      setIsDisabled(false);
      console.error("Post creation error:", error);
      toast.error("Failed to create post. Please try again.");
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-xl md:rounded-2xl shadow-lg border border-gray-100">
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2 md:space-x-3">
            <img
              key={avatarUrl(user)}
              src={avatarUrl(user)}
              alt=""
              className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover"
              onError={(e) => {
                e.target.src = "/avatar.png";
              }}
            />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900 text-sm md:text-base truncate">{user?.first_name} {user?.last_name}</h3>
              <p className="text-xs md:text-sm text-gray-500">Share your climate action</p>
            </div>
          </div>
        </div>
        
        {/* Auth Status */}
        <AuthStatus 
          isAuthenticated={!!getAuthToken()} 
          onLogin={() => window.location.href = '/login'} 
        />
        
        {/* AI Generate Button */}
        <div className="flex justify-end mt-3">
          <button
            onClick={generateContent}
            disabled={isGenerating}
            className={`flex items-center space-x-1 md:space-x-2 px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-medium transition-all duration-200 ${
              getAuthToken() 
                ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700" 
                : "bg-gradient-to-r from-green-500 to-blue-600 text-white hover:from-green-600 hover:to-blue-700"
            } ${isGenerating ? "opacity-50" : ""}`}
          >
            <IoSparklesOutline className="w-3 h-3 md:w-4 md:h-4" />
            <span className="hidden sm:inline">
              {isGenerating ? "Generating..." : 
               !getAuthToken() ? "Generate Content" : "AI Generate"}
            </span>
            <span className="sm:hidden">
              {isGenerating ? "..." : "AI"}
            </span>
          </button>
        </div>
      </div>

      {/* Content Analysis */}
      {contentAnalysis && (
        <div className={`p-2 md:p-3 mx-2 md:mx-4 mt-3 rounded-lg border ${
          contentAnalysis.is_appropriate 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center space-x-2">
            {contentAnalysis.is_appropriate ? (
              <IoCheckmarkCircleOutline className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
            ) : (
              <IoWarningOutline className="w-4 h-4 md:w-5 md:h-5 text-red-600" />
            )}
            <span className={`text-xs md:text-sm font-medium ${
              contentAnalysis.is_appropriate ? 'text-green-800' : 'text-red-800'
            }`}>
              {contentAnalysis.is_appropriate ? 'Content approved' : 'Content needs review'}
            </span>
          </div>
          {contentAnalysis.reason && (
            <p className="text-xs md:text-sm text-gray-600 mt-1">{contentAnalysis.reason}</p>
          )}
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="p-3 md:p-4">
        {/* Text Area */}
        <div className="relative">
          <textarea
            placeholder="Share your thoughts on climate action, sustainability, or environmental topics..."
            className="w-full min-h-[100px] md:min-h-[120px] p-3 md:p-4 border-2 border-gray-200 rounded-xl resize-none focus:border-blue-500 focus:outline-none transition-colors duration-200 text-gray-900 placeholder-gray-400 text-sm md:text-base"
            {...register("content", { 
              required: "Content is required",
              minLength: {
                value: 5,
                message: "Please enter at least 5 characters"
              },
              maxLength: {
                value: 500,
                message: "Content must be less than 500 characters"
              }
            })}
          />
          
          {/* Character Counter */}
          <div className="absolute bottom-2 right-2 text-xs text-gray-400">
            {content?.length || 0}/500
          </div>
        </div>

        {/* Error Messages */}
        {errors.content && (
          <div className="mt-2 text-red-500 text-sm flex items-center space-x-1">
            <IoWarningOutline className="w-4 h-4" />
            <span>{errors.content.message}</span>
          </div>
        )}

        {/* Image Preview */}
        {imagePreview && (
          <div className="mt-4 relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full max-h-64 object-cover rounded-xl"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
            >
              <IoCloseOutline className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Video Preview */}
        {videoPreview && (
          <div className="mt-4 relative">
            <video
              src={videoPreview}
              controls
              className="w-full max-h-64 object-cover rounded-xl"
            />
            <button
              type="button"
              onClick={removeVideo}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
            >
              <IoCloseOutline className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">Choose an emoji</h3>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <IoCloseOutline className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-10 gap-2">
              {commonEmojis.map((emoji, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => addEmoji(emoji)}
                  className="text-2xl hover:bg-gray-200 rounded-lg p-2 transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Location Display */}
        {selectedLocation && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center space-x-2">
              <IoLocationOutline className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-700">
                Location added: {locationAddress || 'Getting address...'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedLocation(null);
                  setLocationAddress(null);
                  setValue('location', '');
                }}
                className="text-green-600 hover:text-green-800"
              >
                <IoCloseOutline className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Hashtag Suggestions */}
        {suggestedHashtags.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Suggested hashtags:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedHashtags.map((hashtag, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => addHashtag(hashtag)}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm hover:bg-blue-200 transition-colors"
                >
                  {hashtag}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Attachment Options */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center space-x-2 md:space-x-4 overflow-x-auto">
            {/* Image Upload */}
            <label className="flex items-center space-x-1 md:space-x-2 text-gray-600 hover:text-blue-600 cursor-pointer transition-colors min-w-0">
              <IoImageOutline className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
              <span className="text-xs md:text-sm hidden sm:inline">Image</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                {...register("image", {
                  onChange: handleImageChange,
                })}
              />
            </label>

            {/* Audio Upload */}
            <label className="flex items-center space-x-1 md:space-x-2 text-gray-600 hover:text-blue-600 cursor-pointer transition-colors min-w-0">
              <IoMusicalNotesOutline className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
              <span className="text-xs md:text-sm hidden sm:inline">Audio</span>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                {...register("audio")}
              />
            </label>

            {/* Video Upload */}
            <label className="flex items-center space-x-1 md:space-x-2 text-gray-600 hover:text-blue-600 cursor-pointer transition-colors min-w-0">
              <IoVideocamOutline className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
              <span className="text-xs md:text-sm hidden sm:inline">Video</span>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                {...register("video", {
                  onChange: handleVideoChange,
                })}
              />
            </label>

            {/* Hidden location field */}
            <input
              type="hidden"
              {...register("location")}
            />

            {/* Emoji Picker */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <IoHappyOutline className="w-5 h-5" />
              <span className="text-sm">Emoji</span>
            </button>

            {/* Location */}
            <button
              type="button"
              onClick={handleLocationClick}
              className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <IoLocationOutline className="w-5 h-5" />
              <span className="text-sm">Location</span>
            </button>
          </div>

          {/* Post Button */}
          <button
            type="submit"
            disabled={isDisabled || isAnalyzing}
            className="flex items-center space-x-1 md:space-x-2 px-4 md:px-6 py-2 bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-full font-medium hover:from-green-600 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
          >
            {isDisabled ? (
              <>
                <div className="w-3 h-3 md:w-4 md:h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span className="hidden sm:inline">Posting...</span>
                <span className="sm:hidden">...</span>
              </>
            ) : (
              <>
                <IoSend className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">Post</span>
                <span className="sm:hidden">✓</span>
              </>
            )}
          </button>
        </div>

        {/* Analysis Indicator */}
        {isAnalyzing && (
          <div className="mt-3 flex items-center space-x-2 text-blue-600">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm">Analyzing content...</span>
          </div>
        )}
      </form>
    </div>
  );
};

export default ModernPostCreator;
