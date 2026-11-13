import { useForm } from "react-hook-form";
import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { endpoints } from "../utils/endpoints";
import { getUser, getAuthToken } from "../utils/factory";
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
  IoVideocamOutline,
  IoEarthOutline,
  IoPeopleOutline,
  IoTextOutline,
} from "react-icons/io5";
import { toast } from "react-toastify";
import { env } from "../config/env";
import {
  QUICK_CITIES,
  readDevicePosition,
  reverseGeocode,
} from "../utils/formatLocation";
import PostFontPicker from "./PostFontPicker";
import { DEFAULT_POST_FONT, postFontStyle } from "../utils/postFonts";
import UserAvatar from "./UserAvatar";

const ModernPostCreator = ({ type = "post", postId, parentId, closeModal }) => {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
    defaultValues: { visibility: "Everyone", location: "" },
  });
  const [user, setUserState] = useState(() => getUser() || null);
  const [imagePreview, setImagePreview] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [audioPreview, setAudioPreview] = useState(null);
  const [audioFileName, setAudioFileName] = useState("");
  const audioInputRef = useRef(null);
  const [isDisabled, setIsDisabled] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestedHashtags, setSuggestedHashtags] = useState([]);
  const [contentAnalysis, setContentAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationAddress, setLocationAddress] = useState(null);
  const [fontFamily, setFontFamily] = useState(DEFAULT_POST_FONT);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const textareaRef = useRef(null);
  const content = watch("content", "");
  const visibility = watch("visibility", "Everyone");
  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.username ||
    "there";
  const isExpanded =
    composerOpen ||
    Boolean(content?.trim()) ||
    Boolean(imagePreview || videoPreview || audioPreview || selectedLocation);

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
          is_appropriate: text.length >= 5,
          reason: text.length < 5 ? "Content is too short" : "",
          climate_related: text.toLowerCase().includes('climate') || text.toLowerCase().includes('environment'),
          has_links: /https?:\/\/|www\./i.test(text),
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
      } else if (response.status === 401 || response.status === 503) {
        const basicAnalysis = {
          is_appropriate: text.length >= 5,
          reason: text.length < 5 ? "Content is too short" : "",
          climate_related: text.toLowerCase().includes('climate') || text.toLowerCase().includes('environment'),
          has_links: /https?:\/\/|www\./i.test(text),
          has_bad_words: false,
          suggestions: []
        };
        setContentAnalysis(basicAnalysis);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Content analysis error:', error);
      const basicAnalysis = {
        is_appropriate: text.length >= 5,
        reason: text.length < 5 ? "Content is too short" : "",
        climate_related: text.toLowerCase().includes('climate') || text.toLowerCase().includes('environment'),
        has_links: /https?:\/\/|www\./i.test(text),
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

  const handleAudioChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Audio size must be less than 20MB");
      return;
    }
    if (audioPreview) URL.revokeObjectURL(audioPreview);
    setAudioPreview(URL.createObjectURL(file));
    setAudioFileName(file.name);
  };

  const removeAudio = () => {
    if (audioPreview) URL.revokeObjectURL(audioPreview);
    setAudioPreview(null);
    setAudioFileName("");
    if (audioInputRef.current) audioInputRef.current.value = "";
    setValue("audio", null);
  };

  // Emoji picker functionality
  const addEmoji = (emoji) => {
    const currentContent = watch('content') || '';
    const newContent = currentContent + emoji;
    setValue('content', newContent);
    setShowEmojiPicker(false);
  };

  const applyLocationLabel = (label, coords = null) => {
    setSelectedLocation(coords || { name: label });
    setLocationAddress(label);
    setValue("location", label);
    setShowLocationPicker(false);
  };

  const handleLocationClick = async () => {
    setShowLocationPicker((open) => !open);
  };

  const handleUseCurrentLocation = async () => {
    try {
      const { latitude, longitude, accuracy } = await readDevicePosition();
      setSelectedLocation({ latitude, longitude, accuracy });
      try {
        const address = await reverseGeocode(latitude, longitude);
        applyLocationLabel(address, { latitude, longitude, accuracy });
        toast.success(
          accuracy
            ? `Location added (±${Math.round(accuracy)} m)`
            : "Location added"
        );
      } catch (error) {
        console.error("Reverse geocoding error:", error);
        const fallback = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        applyLocationLabel(fallback, { latitude, longitude, accuracy });
        toast.success("Coordinates added. Address lookup failed.");
      }
    } catch (error) {
      console.error("Error getting location:", error);
      if (error?.code === "LOW_ACCURACY") {
        toast.error(error.message);
        setShowLocationPicker(true);
        return;
      }
      toast.error("Unable to get your location. Pick a city instead.");
      setShowLocationPicker(true);
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
      formData.append('visibility', data.visibility || 'Everyone');
      formData.append('font_family', fontFamily || DEFAULT_POST_FONT);
      
      // Add location if available
      if (data.location) {
        formData.append('location', data.location);
      }
      
      // Add post/comment relationships
      if (postId) formData.append('post', postId);
      if (parentId) formData.append('parent_comment', parentId);
      
      // Handle image files - upload to Cloudinary and send URL
      if (data.image && data.image.length > 0 && data.image[0] instanceof File) {
        const imageUrl = await uploadFiles(data.image[0]);
        if (imageUrl && imageUrl.length > 0) {
          formData.append('image', imageUrl[0]);
        }
      }
      
      // Handle video files - upload to Cloudinary and send URL
      if (data.video && data.video.length > 0 && data.video[0] instanceof File) {
        const videoUrl = await uploadFiles(data.video[0]);
        if (videoUrl && videoUrl.length > 0) {
          formData.append('video', videoUrl[0]);
        }
      }
      
      // Handle audio files - upload to Cloudinary and send URL (same as image/video)
      if (data.audio && data.audio.length > 0 && data.audio[0] instanceof File) {
        const audioUrl = await uploadFiles(data.audio[0]);
        if (audioUrl && audioUrl.length > 0) {
          formData.append('audio', audioUrl[0]);
        }
      }
      
      const endpoint = endpoints[type];
      const token = getAuthToken();
      const response = await fetch(`${env.backendUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      toast.success("Post created successfully! 🌱");
      
      reset({ visibility: "Everyone", location: "", content: "" });
      setImagePreview(null);
      setVideoPreview(null);
      removeAudio();
      setSelectedLocation(null);
      setLocationAddress(null);
      setSuggestedHashtags([]);
      setContentAnalysis(null);
      setFontFamily(DEFAULT_POST_FONT);
      setIsDisabled(false);

      await queryClient.invalidateQueries({ queryKey: ["post"] });
      
      if (closeModal) closeModal();
      
    } catch (error) {
      setIsDisabled(false);
      console.error("Post creation error:", error);
      toast.error("Failed to create post. Please try again.");
    }
  };

  const contentRegister = register("content", {
    required: "Content is required",
    minLength: {
      value: 5,
      message: "Please enter at least 5 characters",
    },
    maxLength: {
      value: 500,
      message: "Content must be less than 500 characters",
    },
  });

  const openComposer = () => {
    setComposerOpen(true);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const toolBtn =
    "inline-flex h-10 w-10 items-center justify-center text-foreground hover:bg-background transition-colors";

  return (
    <div className="w-full max-w-2xl mx-auto bg-surface border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-base font-semibold text-foreground text-center">Create post</h2>
      </div>

      {!isExpanded ? (
        <button
          type="button"
          onClick={openComposer}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-background/60 transition-colors"
        >
          <UserAvatar user={user} className="h-10 w-10" textClassName="text-sm" alt="" />
          <span className="flex-1 min-h-10 flex items-center px-4 bg-background border border-border text-muted text-sm md:text-base">
            What&apos;s on your mind, {user?.first_name || displayName}?
          </span>
        </button>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
          <div className="px-4 pt-4 pb-2 flex items-start gap-3">
            <UserAvatar user={user} className="h-10 w-10 shrink-0" textClassName="text-sm" alt="" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground text-sm leading-tight truncate">
                {displayName}
              </p>
              <label className="mt-1.5 inline-flex items-center gap-1.5 min-h-8 px-2.5 border border-border bg-background text-xs font-medium text-foreground cursor-pointer hover:border-primary">
                {visibility === "Friends" ? (
                  <IoPeopleOutline size={14} className="text-primary" />
                ) : (
                  <IoEarthOutline size={14} className="text-primary" />
                )}
                <select
                  className="bg-transparent border-0 text-xs font-medium text-foreground focus:outline-none cursor-pointer pr-1"
                  {...register("visibility")}
                >
                  <option value="Everyone">Everyone</option>
                  <option value="Friends">Friends</option>
                </select>
              </label>
            </div>
            <button
              type="button"
              onClick={generateContent}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 min-h-8 px-2.5 text-xs font-medium text-primary border border-border hover:bg-background disabled:opacity-60"
              title="Draft with AI"
            >
              <IoSparklesOutline size={14} />
              {isGenerating ? "Drafting…" : "Draft"}
            </button>
          </div>

          {contentAnalysis ? (
            <div
              className={`mx-4 mb-2 px-3 py-2 border text-xs ${
                contentAnalysis.is_appropriate
                  ? "border-border bg-background text-foreground"
                  : "border-destructive/40 bg-background text-destructive"
              }`}
            >
              <div className="flex items-center gap-1.5 font-medium">
                {contentAnalysis.is_appropriate ? (
                  <IoCheckmarkCircleOutline size={14} />
                ) : (
                  <IoWarningOutline size={14} />
                )}
                {contentAnalysis.is_appropriate
                  ? "Looks good to post"
                  : "Needs a quick review"}
              </div>
              {contentAnalysis.reason ? (
                <p className="mt-1 text-muted">{contentAnalysis.reason}</p>
              ) : null}
            </div>
          ) : null}

          <div className="px-4">
            <textarea
              {...contentRegister}
              ref={(el) => {
                contentRegister.ref(el);
                textareaRef.current = el;
              }}
              onFocus={() => setComposerOpen(true)}
              placeholder={`What's on your mind, ${user?.first_name || displayName}?`}
              rows={4}
              className="w-full min-h-[120px] md:min-h-[140px] resize-none border-0 bg-transparent text-foreground placeholder:text-muted text-lg leading-relaxed focus:outline-none"
              style={postFontStyle(fontFamily)}
            />
            <div className="flex justify-end pb-1">
              <span
                className={`text-xs ${
                  (content?.length || 0) > 480 ? "text-destructive" : "text-muted"
                }`}
              >
                {content?.length || 0}/500
              </span>
            </div>
            {errors.content ? (
              <p className="pb-2 text-sm text-destructive flex items-center gap-1">
                <IoWarningOutline size={14} />
                {errors.content.message}
              </p>
            ) : null}
          </div>

          {imagePreview ? (
            <div className="relative mx-4 mb-3 border border-border overflow-hidden">
              <img src={imagePreview} alt="Preview" className="w-full max-h-72 object-cover" />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 h-8 w-8 inline-flex items-center justify-center bg-background/95 border border-border text-foreground"
                aria-label="Remove image"
              >
                <IoCloseOutline size={16} />
              </button>
            </div>
          ) : null}

          {videoPreview ? (
            <div className="relative mx-4 mb-3 border border-border overflow-hidden">
              <video src={videoPreview} controls className="w-full max-h-72 object-contain bg-background" />
              <button
                type="button"
                onClick={removeVideo}
                className="absolute top-2 right-2 h-8 w-8 inline-flex items-center justify-center bg-background/95 border border-border text-foreground"
                aria-label="Remove video"
              >
                <IoCloseOutline size={16} />
              </button>
            </div>
          ) : null}

          {audioPreview ? (
            <div className="relative mx-4 mb-3 border border-border bg-background p-3">
              <p className="text-sm font-medium text-foreground mb-2 truncate pr-8">
                {audioFileName || "Audio attached"}
              </p>
              <audio src={audioPreview} controls className="w-full" />
              <button
                type="button"
                onClick={removeAudio}
                className="absolute top-2 right-2 h-8 w-8 inline-flex items-center justify-center border border-border text-foreground"
                aria-label="Remove audio"
              >
                <IoCloseOutline size={16} />
              </button>
            </div>
          ) : null}

          {selectedLocation && locationAddress ? (
            <div className="mx-4 mb-3 flex items-start gap-2 border border-border bg-background px-3 py-2">
              <IoLocationOutline className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{locationAddress}</p>
                {selectedLocation.latitude != null && selectedLocation.longitude != null ? (
                  <p className="text-xs text-muted mt-0.5">
                    {Number(selectedLocation.latitude).toFixed(5)},{" "}
                    {Number(selectedLocation.longitude).toFixed(5)}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedLocation(null);
                  setLocationAddress(null);
                  setValue("location", "");
                }}
                className="text-muted hover:text-foreground"
                aria-label="Remove location"
              >
                <IoCloseOutline size={16} />
              </button>
            </div>
          ) : null}

          {showFontPicker ? (
            <div className="mx-4 mb-3 border border-border bg-background p-3">
              <PostFontPicker
                value={fontFamily}
                onChange={setFontFamily}
                compact
              />
            </div>
          ) : null}

          {showEmojiPicker ? (
            <div className="mx-4 mb-3 border border-border bg-background p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-foreground">Emoji</p>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(false)}
                  className="text-muted hover:text-foreground"
                  aria-label="Close emoji"
                >
                  <IoCloseOutline size={16} />
                </button>
              </div>
              <div className="grid grid-cols-8 sm:grid-cols-10 gap-1">
                {commonEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => addEmoji(emoji)}
                    className="h-9 text-xl hover:bg-surface"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {showLocationPicker ? (
            <div className="mx-4 mb-3 border border-border bg-background p-3">
              <p className="text-sm font-medium text-foreground mb-2">Add location</p>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="w-full text-left px-3 py-2 text-sm border border-border hover:bg-surface mb-2"
              >
                Use my current GPS location
              </button>
              <div className="flex flex-wrap gap-2">
                {QUICK_CITIES.map((city) => (
                  <button
                    key={city.name}
                    type="button"
                    onClick={() => {
                      applyLocationLabel(city.name);
                      toast.success(`Location set to ${city.name}`);
                    }}
                    className="px-3 py-1.5 text-xs border border-border hover:border-primary hover:text-primary"
                  >
                    {city.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {suggestedHashtags.length > 0 ? (
            <div className="mx-4 mb-3 flex flex-wrap gap-2">
              {suggestedHashtags.map((hashtag) => (
                <button
                  key={hashtag}
                  type="button"
                  onClick={() => addHashtag(hashtag)}
                  className="px-2.5 py-1 text-xs border border-border text-primary hover:bg-background"
                >
                  {hashtag}
                </button>
              ))}
            </div>
          ) : null}

          <input type="hidden" {...register("location")} />

          <div className="mx-4 mb-3 flex flex-wrap items-center justify-between gap-2 border border-border px-2 py-1.5">
            <p className="text-sm font-medium text-foreground px-1">Add to your post</p>
            <div className="flex items-center gap-0.5">
              <label className={`${toolBtn} cursor-pointer`} title="Photo">
                <IoImageOutline size={22} className="text-primary" />
                <span className="sr-only">Photo</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  {...register("image", { onChange: handleImageChange })}
                />
              </label>
              <label className={`${toolBtn} cursor-pointer`} title="Video">
                <IoVideocamOutline size={22} className="text-primary" />
                <span className="sr-only">Video</span>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  {...register("video", { onChange: handleVideoChange })}
                />
              </label>
              <label className={`${toolBtn} cursor-pointer`} title="Audio">
                <IoMusicalNotesOutline size={22} className="text-primary" />
                <span className="sr-only">Audio</span>
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  {...(() => {
                    const { ref, ...rest } = register("audio", {
                      onChange: handleAudioChange,
                    });
                    return {
                      ...rest,
                      ref: (el) => {
                        audioInputRef.current = el;
                        ref(el);
                      },
                    };
                  })()}
                />
              </label>
              <button
                type="button"
                className={toolBtn}
                title="Emoji"
                onClick={() => {
                  setShowEmojiPicker((v) => !v);
                  setShowLocationPicker(false);
                  setShowFontPicker(false);
                }}
              >
                <IoHappyOutline size={22} className="text-primary" />
              </button>
              <button
                type="button"
                className={toolBtn}
                title="Location"
                onClick={() => {
                  handleLocationClick();
                  setShowEmojiPicker(false);
                  setShowFontPicker(false);
                }}
              >
                <IoLocationOutline size={22} className="text-primary" />
              </button>
              <button
                type="button"
                className={toolBtn}
                title="Font"
                aria-pressed={showFontPicker}
                onClick={() => {
                  setShowFontPicker((v) => !v);
                  setShowEmojiPicker(false);
                  setShowLocationPicker(false);
                }}
              >
                <IoTextOutline size={22} className="text-primary" />
              </button>
            </div>
          </div>

          <div className="px-4 pb-4 flex items-center gap-2">
            {isAnalyzing ? (
              <p className="text-xs text-muted flex-1">Checking your post…</p>
            ) : (
              <span className="flex-1" />
            )}
            <button
              type="button"
              onClick={() => {
                if (!content?.trim() && !imagePreview && !videoPreview && !audioPreview) {
                  setComposerOpen(false);
                }
              }}
              className="min-h-10 px-3 text-sm font-medium border border-border text-foreground hover:bg-background"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isDisabled || isAnalyzing}
              className="min-h-10 px-5 bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-dark disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isDisabled ? (
                <>
                  <span className="h-3.5 w-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Posting…
                </>
              ) : (
                <>
                  <IoSend size={15} />
                  Post
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ModernPostCreator;
