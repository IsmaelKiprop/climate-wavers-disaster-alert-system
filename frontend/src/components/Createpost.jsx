import { useForm } from "react-hook-form";
import { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { getUser, avatarUrl } from "../utils/factory";
import { uploadFiles } from "../services/upload.service";
import { getAuthToken } from "../utils/factory";
import { toast } from "react-toastify";
import LazyEmojiPicker from "./LazyEmojiPicker";
import { IoSend, IoCloseSharp, IoLocationOutline, IoHappyOutline, IoVideocamOutline, IoImageOutline, IoSparklesOutline } from "react-icons/io5";
import { MdEmojiEmotions, MdLocationOn, MdVideocam, MdImage, MdAutoAwesome } from "react-icons/md";
import { env } from "../config/env";
import {
  locationFieldValue,
  readDevicePosition,
  reverseGeocode,
} from "../utils/formatLocation";
import PostFontPicker from "./PostFontPicker";
import PostMediaCarousel from "./PostMediaCarousel";
import { DEFAULT_POST_FONT, postFontStyle } from "../utils/postFonts";
import {
  createMediaItem,
  encodePostImages,
  revokeMediaItems,
} from "../utils/postMedia";

const MAX_MEDIA = 10;

export default function Createpost({ type, postId, parentId, closeModal }) {
  const { register, handleSubmit, reset, watch, setValue } = useForm();
  const [mediaItems, setMediaItems] = useState([]);
  const [isDisabled, setIsDisabled] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showAIFeatures, setShowAIFeatures] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [aiGeneratedContent, setAiGeneratedContent] = useState("");
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [fontFamily, setFontFamily] = useState(DEFAULT_POST_FONT);
  const mediaInputRef = useRef(null);
  const aiPromptRef = useRef(null);
  const [user, setUserState] = useState(() => getUser() || null);

  useEffect(() => {
    const sync = () => setUserState(getUser() || null);
    window.addEventListener("userUpdated", sync);
    return () => window.removeEventListener("userUpdated", sync);
  }, []);

  useEffect(() => {
    return () => revokeMediaItems(mediaItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addMediaFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    const room = MAX_MEDIA - mediaItems.length;
    if (room <= 0) {
      toast.error(`You can add up to ${MAX_MEDIA} photos or videos`);
      return;
    }
    const next = [];
    for (const file of incoming.slice(0, room)) {
      const item = createMediaItem(file);
      if (item) next.push(item);
      else toast.error(`${file.name} is not a supported photo or video`);
    }
    if (next.length) setMediaItems((prev) => [...prev, ...next]);
  };

  const handleMediaInputChange = (e) => {
    addMediaFiles(e.target.files);
    e.target.value = "";
  };

  const removeMediaAt = (index) => {
    setMediaItems((prev) => {
      const target = prev[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const clearMedia = () => {
    revokeMediaItems(mediaItems);
    setMediaItems([]);
    if (mediaInputRef.current) mediaInputRef.current.value = "";
  };

  const handleEmojiClick = (emoji) => {
    const currentContent = watch("content") || "";
    setValue("content", currentContent + emoji);
    setShowEmojiPicker(false);
  };

  const handleLocationSelect = async (location) => {
    if (location.type === "current") {
      await getCurrentLocation();
    } else {
      setSelectedLocation(location);
      setValue("location", location.name);
      setShowLocationPicker(false);
    }
  };

  const getCurrentLocation = async () => {
    setIsGettingLocation(true);
    setLocationError(null);

    try {
      const { latitude, longitude, accuracy } = await readDevicePosition();
      let address = "";
      try {
        address = await reverseGeocode(latitude, longitude);
      } catch (geocodeError) {
        console.error("Reverse geocoding failed:", geocodeError);
      }

      const currentLocation = {
        name:
          address ||
          `Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
        type: "current",
        coordinates: { latitude, longitude },
        accuracy,
        address,
      };

      setSelectedLocation(currentLocation);
      setValue("location", currentLocation.name);
      setShowLocationPicker(false);
    } catch (error) {
      console.error("Error getting location:", error);
      setLocationError(
        error?.code === "LOW_ACCURACY"
          ? error.message
          : "Unable to get your current location. Please try again or select a city manually."
      );
    } finally {
      setIsGettingLocation(false);
    }
  };

  const analyzeContent = async (content) => {
    if (!content.trim()) return;
    
    // Check if user is authenticated
    const accessToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    if (!accessToken) {
      console.log("User not authenticated, skipping AI analysis");
      return;
    }
    
    setIsAnalyzing(true);
    try {
      // Real AI analysis using the backend API with proper authentication
      const response = await client.run("post", "/api/v1/ai/analyze-content/", { content }, true, false, false);
      
      if (response && response.suggestions) {
        setAiSuggestions(response.suggestions);
      } else {
        // Fallback to local analysis
        const suggestions = generateLocalSuggestions(content);
        setAiSuggestions(suggestions);
      }
    } catch (error) {
      console.error("AI analysis failed:", error);
      // Fallback to local analysis
      const suggestions = generateLocalSuggestions(content);
      setAiSuggestions(suggestions);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateLocalSuggestions = (content) => {
    const suggestions = [];
    const lowerContent = content.toLowerCase();

    if (!lowerContent.includes('#')) {
      suggestions.push("Consider adding relevant hashtags like #ClimateAction or #Sustainability");
    }

    if (!lowerContent.includes('!') && !lowerContent.includes('?')) {
      suggestions.push("Add a call-to-action to encourage engagement");
    }

    if (content.length < 50) {
      suggestions.push("Consider expanding your post for better engagement");
    }

    if (!lowerContent.includes('🌱') && !lowerContent.includes('🌍')) {
      suggestions.push("Add environmental emojis to increase visibility");
    }

    if (!selectedLocation) {
      suggestions.push("Share your location to connect with local climate activists");
    }

    return suggestions;
  };

  const generateAIContent = async (prompt) => {
    if (!prompt.trim()) {
      alert("Please enter a description of what you want to post about!");
      return;
    }

    // Check if user is authenticated
    const accessToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    if (!accessToken) {
      alert("Please log in to use AI features!");
      return;
    }

    console.log("Generating AI content for prompt:", prompt);
    setIsGeneratingContent(true);
    
    try {
      // Try the AI endpoint first
      console.log("Calling AI endpoint...");
      const response = await client.run("post", "/api/v1/ai/generate-content/", { 
        topic: prompt,
        type: "social_media_post"
      }, true, false, false);
      
      console.log("AI endpoint response:", response);
      
      if (response && (response.content || response.full_content)) {
        // Use the AI-generated content
        const fullContent = response.full_content || response.content;
        console.log("Using AI-generated content:", fullContent);
        setAiGeneratedContent(fullContent);
        setValue("content", fullContent);
        setShowAIFeatures(false);
        return;
      }
    } catch (error) {
      console.error("AI endpoint failed:", error);
    }
    
    // Fallback to local content generation
    console.log("Using fallback content generation");
    try {
      const fallbackContent = generateSmartContent(prompt);
      console.log("Generated fallback content:", fallbackContent);
      setAiGeneratedContent(fallbackContent);
      setValue("content", fallbackContent);
      setShowAIFeatures(false);
    } catch (fallbackError) {
      console.error("Fallback generation failed:", fallbackError);
      alert("Content generation failed. Please try again.");
    } finally {
      setIsGeneratingContent(false);
    }
  };

  const generateAIHashtags = async (content) => {
    try {
      const response = await client.run("post", "/api/v1/ai/generate-hashtags/", { content }, true, false, false);
      
      if (response && response.hashtags) {
        return response.hashtags;
      }
    } catch (error) {
      console.error("AI hashtag generation failed:", error);
    }
    
    // Fallback to local hashtag generation
    return generateLocalHashtags(content);
  };

  const generateLocalHashtags = (content) => {
    const hashtags = [];
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('climate')) hashtags.push('#ClimateAction');
    if (lowerContent.includes('sustainability')) hashtags.push('#Sustainability');
    if (lowerContent.includes('environment')) hashtags.push('#Environment');
    if (lowerContent.includes('green')) hashtags.push('#GreenLiving');
    if (lowerContent.includes('energy')) hashtags.push('#CleanEnergy');
    if (lowerContent.includes('water')) hashtags.push('#WaterConservation');
    if (lowerContent.includes('waste')) hashtags.push('#ZeroWaste');
    if (lowerContent.includes('community')) hashtags.push('#CommunityAction');
    
    return hashtags.length > 0 ? hashtags : ['#ClimateAction', '#Sustainability'];
  };

  const generateSmartContent = (prompt) => {
    const lowerPrompt = prompt.toLowerCase();
    
    // Climate action keywords
    const climateKeywords = ['climate', 'environment', 'sustainability', 'green', 'eco', 'carbon', 'emission', 'renewable', 'solar', 'wind', 'energy'];
    const actionKeywords = ['action', 'change', 'movement', 'activism', 'protest', 'campaign', 'initiative', 'project'];
    const communityKeywords = ['community', 'together', 'united', 'local', 'neighborhood', 'city', 'town'];
    
    // Determine content type and generate accordingly
    let content = "";
    let hashtags = [];
    let emoji = "🌱";
    
    // Check for climate-related content
    if (climateKeywords.some(keyword => lowerPrompt.includes(keyword))) {
      emoji = "🌍";
      hashtags.push("#ClimateAction", "#Sustainability", "#GreenFuture");
      
      if (actionKeywords.some(keyword => lowerPrompt.includes(keyword))) {
        content = `🌍 ${prompt} - Every action counts in our fight against climate change! Let's work together for a sustainable future. `;
        hashtags.push("#ClimateJustice", "#EnvironmentalAction");
      } else {
        content = `🌱 ${prompt} - Small steps lead to big changes! Join the movement for environmental sustainability. `;
        hashtags.push("#ClimateHope", "#GreenLiving");
      }
    }
    // Check for community-related content
    else if (communityKeywords.some(keyword => lowerPrompt.includes(keyword))) {
      emoji = "🤝";
      hashtags.push("#CommunityAction", "#LocalImpact", "#TogetherWeCan");
      content = `🤝 ${prompt} - Community action creates the strongest impact! Let's unite for positive change. `;
    }
    // Check for energy-related content
    else if (lowerPrompt.includes('energy') || lowerPrompt.includes('renewable') || lowerPrompt.includes('solar')) {
      emoji = "⚡";
      hashtags.push("#RenewableEnergy", "#CleanEnergy", "#SolarPower");
      content = `⚡ ${prompt} - Clean energy is the future! Let's accelerate the transition to renewable sources. `;
    }
    // Check for water-related content
    else if (lowerPrompt.includes('water') || lowerPrompt.includes('ocean') || lowerPrompt.includes('sea')) {
      emoji = "💧";
      hashtags.push("#WaterConservation", "#OceanProtection", "#BluePlanet");
      content = `💧 ${prompt} - Water is life! Let's protect our precious water resources for future generations. `;
    }
    // Check for waste-related content
    else if (lowerPrompt.includes('waste') || lowerPrompt.includes('recycle') || lowerPrompt.includes('plastic')) {
      emoji = "♻️";
      hashtags.push("#ZeroWaste", "#Recycling", "#PlasticFree");
      content = `♻️ ${prompt} - Reduce, reuse, recycle! Every small action helps protect our planet. `;
    }
    // Check for transportation-related content
    else if (lowerPrompt.includes('transport') || lowerPrompt.includes('bike') || lowerPrompt.includes('walk') || lowerPrompt.includes('car')) {
      emoji = "🚴";
      hashtags.push("#SustainableTransport", "#GreenMobility", "#ActiveTransport");
      content = `🚴 ${prompt} - Sustainable transportation choices make a difference! Let's reduce our carbon footprint. `;
    }
    // Default climate action content
    else {
      emoji = "🌱";
      hashtags.push("#ClimateAction", "#Sustainability", "#GreenFuture");
      content = `🌱 ${prompt} - Every voice matters in the fight for our planet! Let's create positive change together. `;
    }
    
    // Add location-based hashtags if location is selected
    if (selectedLocation) {
      if (selectedLocation.name.includes('Nairobi')) {
        hashtags.push("#NairobiClimate", "#KenyaClimate");
      } else if (selectedLocation.name.includes('Mombasa')) {
        hashtags.push("#MombasaClimate", "#CoastalClimate");
      } else if (selectedLocation.name.includes('Kisumu')) {
        hashtags.push("#KisumuClimate", "#LakeRegion");
      }
    }
    
    // Add call-to-action
    const callToActions = [
      "What actions are you taking for climate change? Share your story!",
      "How are you making a difference in your community? Let's inspire others!",
      "What sustainable practices do you follow? Let's learn from each other!",
      "Join the conversation and share your climate action ideas!",
      "Together we can create a better future for our planet!"
    ];
    
    const randomCTA = callToActions[Math.floor(Math.random() * callToActions.length)];
    content += randomCTA + " ";
    
    // Add hashtags
    content += hashtags.join(" ");
    
    return content;
  };

  const generateFallbackContent = (prompt) => {
    const templates = [
      `🌱 ${prompt} - Let's work together for a sustainable future! #ClimateAction #Sustainability`,
      `🌍 ${prompt} - Every small action counts in our fight against climate change. #ClimateWavers #GreenFuture`,
      `⚡ ${prompt} - Join the movement for environmental justice! #ClimateJustice #CommunityAction`,
      `🚀 ${prompt} - Together we can create positive change for our planet! #ClimateHope #CollectiveAction`
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  };


  const toastMsg = {
    success: "Post Successful 👌",
    error: "An Error occured 🤯",
  };

  const onSubmit = async (data) => {
    setIsDisabled(true);
    
    try {
      const formData = new FormData();
      
      // Add text content
      formData.append('content', data.content || '');
      formData.append('visibility', data.visibility || 'Everyone');
      formData.append('font_family', fontFamily || DEFAULT_POST_FONT);
      formData.append(
        "location",
        locationFieldValue(selectedLocation, data.location || "")
      );
      
      // Add post/comment relationships
      if (postId) formData.append('post_id', postId);
      if (parentId) formData.append('parent_comment', parentId);
      
      const imageFiles = mediaItems
        .filter((item) => item.kind === "image")
        .map((item) => item.file);
      const videoFiles = mediaItems
        .filter((item) => item.kind === "video")
        .map((item) => item.file);

      if (imageFiles.length) {
        const imageUrls = await uploadFiles(imageFiles);
        const encoded = encodePostImages(imageUrls);
        if (encoded) formData.append("image", encoded);
      }

      if (videoFiles.length) {
        const videoUrls = await uploadFiles(videoFiles);
        if (videoUrls?.[0]) formData.append("video", videoUrls[0]);
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
      clearMedia();
      setSelectedLocation(null);
      setFontFamily(DEFAULT_POST_FONT);
      setIsDisabled(false);
      closeModal();
      
    } catch (error) {
      setIsDisabled(false);
      console.error("Post creation error:", error);
      toast.error("Failed to create post. Please try again.");
    }
  };

  const buttonMsg = type === "post" ? type : "Reply";

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="p-6 flex flex-col gap-6"
    >
      <div className="flex items-center gap-4">
        <img
          src={avatarUrl(user)}
          alt="Profile"
          className="w-12 h-12 rounded-full object-cover"
          onError={(e) => {
            e.target.src = "/avatar.png";
          }}
        />
        <div className="flex-1">
        <select
            className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 bg-white hover:border-[#2F4F4F] focus:border-[#2F4F4F] focus:outline-none transition-colors duration-200"
          {...register("visibility", { required: true })}
        >
            <option value="Everyone">🌍 Everyone</option>
            <option value="Friends">👥 Friends</option>
        </select>
        </div>
      </div>

      <div className="relative">
      <textarea
          placeholder="What's on your mind?"
          className="w-full min-h-[120px] p-4 text-lg text-foreground placeholder:text-muted border border-border bg-surface resize-none focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200"
          style={postFontStyle(fontFamily)}
        {...register("content", { required: true })}
          onChange={(e) => {
            const content = e.target.value;
            if (content.length > 10) {
              analyzeContent(content);
            }
          }}
        />
        
        {/* AI Analysis Indicator */}
        {isAnalyzing && (
          <div className="absolute top-2 right-2 flex items-center gap-2 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-sm">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span>AI Analyzing...</span>
          </div>
        )}
      </div>

      <PostFontPicker value={fontFamily} onChange={setFontFamily} />

      {/* AI Suggestions */}
      {aiSuggestions.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <MdAutoAwesome className="text-purple-600" size={20} />
            <span className="font-medium text-purple-800">AI Suggestions</span>
          </div>
          <div className="space-y-2">
            {aiSuggestions.map((suggestion, index) => (
              <div key={index} className="text-sm text-purple-700 bg-white/50 rounded-lg p-2">
                {suggestion}
              </div>
            ))}
          </div>
        </div>
      )}
      {mediaItems.length ? (
        <PostMediaCarousel
          items={mediaItems}
          onAddFiles={addMediaFiles}
          onRemoveAt={removeMediaAt}
          onClear={clearMedia}
          maxItems={MAX_MEDIA}
          className="!mx-0"
        />
      ) : null}

      {/* Selected Location Display */}
      {selectedLocation && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3">
          <MdLocationOn className="text-green-600" size={20} />
          <span className="text-green-800 font-medium">{selectedLocation.name}</span>
          <button
            type="button"
            onClick={() => {
              setSelectedLocation(null);
              setValue("location", "");
            }}
            className="ml-auto p-1 hover:bg-green-100 rounded-full transition-colors"
          >
            <IoCloseSharp size={16} className="text-green-600" />
          </button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 border-t border-gray-100 gap-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => mediaInputRef.current?.click()}
            className="flex items-center gap-1 sm:gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
          >
            <MdImage className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
            <span className="text-xs sm:text-sm font-medium text-gray-600 hidden sm:inline">Photo</span>
          </button>

          <button
            type="button"
            onClick={() => mediaInputRef.current?.click()}
            className="flex items-center gap-1 sm:gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
          >
            <MdVideocam className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
            <span className="text-xs sm:text-sm font-medium text-gray-600 hidden sm:inline">Video</span>
          </button>

          {/* Emoji Picker */}
          <div className="relative">
            <button 
              type="button" 
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="flex items-center gap-1 sm:gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
            >
              <MdEmojiEmotions className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
              <span className="text-xs sm:text-sm font-medium text-gray-600 hidden sm:inline">Emoji</span>
            </button>
            
            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 mb-2 z-10">
                <LazyEmojiPicker
                  onEmojiClick={(emojiData) => handleEmojiClick(emojiData.emoji)}
                  width={300}
                  height={350}
                  searchDisabled={false}
                  skinTonesDisabled={false}
                  previewConfig={{
                    defaultCaption: "Choose an emoji!",
                    showPreview: true
                  }}
                />
              </div>
            )}
          </div>

          {/* Location Picker */}
          <div className="relative">
            <button 
              type="button" 
              onClick={() => setShowLocationPicker(!showLocationPicker)}
              className="flex items-center gap-1 sm:gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
            >
              <MdLocationOn className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
              <span className="text-xs sm:text-sm font-medium text-gray-600 hidden sm:inline">Location</span>
            </button>
            
            {showLocationPicker && (
              <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-10 w-64 sm:w-72">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700 mb-2">Select Location</div>
                  
                  {/* Current Location Button */}
                  <button
                    type="button"
                    onClick={() => handleLocationSelect({ name: "Current Location", type: "current" })}
                    disabled={isGettingLocation}
                    className="w-full text-left p-2 hover:bg-gray-100 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isGettingLocation ? (
                      <>
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>Getting location...</span>
                      </>
                    ) : (
                      <>
                        <MdLocationOn className="text-blue-600" size={16} />
                        <span>Current Location</span>
                      </>
                    )}
                  </button>

                  {/* Location Error */}
                  {locationError && (
                    <div className="text-red-600 text-xs p-2 bg-red-50 rounded-lg">
                      {locationError}
                    </div>
                  )}

                  {/* Manual Location Options */}
                  <div className="border-t border-gray-100 pt-2">
                    <div className="text-xs text-gray-500 mb-2">Or select a city:</div>
                    {[
                      { name: "Nairobi, Kenya", type: "city" },
                      { name: "Mombasa, Kenya", type: "city" },
                      { name: "Kisumu, Kenya", type: "city" },
                      { name: "Eldoret, Kenya", type: "city" },
                      { name: "Nakuru, Kenya", type: "city" }
                    ].map((location, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleLocationSelect(location)}
                        className="w-full text-left p-2 hover:bg-gray-100 rounded-lg transition-colors text-sm flex items-center gap-2"
                      >
                        <MdLocationOn className="text-gray-500" size={16} />
                        {location.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AI Features */}
          <button 
            type="button" 
            onClick={() => setShowAIFeatures(!showAIFeatures)}
            className="flex items-center gap-1 sm:gap-2 p-2 rounded-lg hover:bg-purple-100 transition-colors duration-200"
          >
            <MdAutoAwesome className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
            <span className="text-xs sm:text-sm font-medium text-purple-600 hidden sm:inline">AI</span>
          </button>

          <input
            ref={mediaInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handleMediaInputChange}
          />
        </div>

        {/* AI Features Panel */}
        {showAIFeatures && (
          <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-10 w-80 sm:w-96">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <MdAutoAwesome className="text-purple-600" size={20} />
                <span className="font-medium text-gray-800">AI Features</span>
              </div>
              
              {/* AI Content Generation */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">Generate Content</div>
                <div className="flex gap-2">
                  <input
                    ref={aiPromptRef}
                    type="text"
                    placeholder="Describe what you want to post about..."
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        generateAIContent(e.target.value);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      console.log("Generate button clicked");
                      const prompt = aiPromptRef.current?.value || "";
                      console.log("Prompt value:", prompt);
                      if (prompt.trim()) {
                        console.log("Calling generateAIContent with prompt:", prompt);
                        generateAIContent(prompt);
                        aiPromptRef.current.value = ""; // Clear input after generation
                      } else {
                        console.log("No prompt provided");
                        alert("Please enter a description of what you want to post about!");
                      }
                    }}
                    disabled={isGeneratingContent}
                    className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {isGeneratingContent ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <MdAutoAwesome size={14} />
                        <span>Generate</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Test AI Button */}
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => {
                    console.log("Test AI button clicked");
                    generateAIContent("climate action");
                  }}
                  className="w-full px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
                >
                  🧪 Test AI (Climate Action)
                </button>
              </div>

              {/* Quick Actions */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-700">Quick Actions</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const currentContent = watch("content") || "";
                      if (currentContent.trim()) {
                        try {
                          const hashtags = await generateAIHashtags(currentContent);
                          setValue("content", currentContent + " " + hashtags.join(" "));
                        } catch (error) {
                          setValue("content", currentContent + " #ClimateAction #Sustainability #GreenFuture");
                        }
                      } else {
                        setValue("content", currentContent + " #ClimateAction #Sustainability #GreenFuture");
                      }
                      setShowAIFeatures(false);
                    }}
                    className="text-left p-2 hover:bg-purple-50 rounded-lg transition-colors text-sm"
                  >
                    ✨ Add Hashtags
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      const currentContent = watch("content") || "";
                      setValue("content", currentContent + " 🌱 Let's work together for a sustainable future!");
                      setShowAIFeatures(false);
                    }}
                    className="text-left p-2 hover:bg-purple-50 rounded-lg transition-colors text-sm"
                  >
                    🚀 Add CTA
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      const currentContent = watch("content") || "";
                      setValue("content", currentContent + " 📍 Share your location for local impact!");
                      setShowAIFeatures(false);
                    }}
                    className="text-left p-2 hover:bg-purple-50 rounded-lg transition-colors text-sm"
                  >
                    📍 Location Tip
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const currentContent = watch("content") || "";
                      setValue("content", currentContent + " 🌍 Every action counts in our fight against climate change!");
                      setShowAIFeatures(false);
                    }}
                    className="text-left p-2 hover:bg-purple-50 rounded-lg transition-colors text-sm"
                  >
                    🌍 Inspire
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isDisabled}
          className={`flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-medium transition-all duration-200 w-full sm:w-auto justify-center ${
            isDisabled
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-[#2F4F4F] text-white hover:bg-[#1a3a3a] hover:shadow-lg transform hover:-translate-y-0.5"
          }`}
        >
          {isDisabled ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm sm:text-base">Posting...</span>
            </>
          ) : (
            <>
              <IoSend size={16} className="sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base">{buttonMsg}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

Createpost.propTypes = {
  closeModal: PropTypes.func,
  postId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  type: PropTypes.string,
  parentId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
