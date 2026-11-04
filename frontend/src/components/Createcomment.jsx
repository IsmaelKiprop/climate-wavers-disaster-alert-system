import { useForm } from "react-hook-form";
import PropTypes from "prop-types";
import { getUser, getAuthToken, avatarUrl } from "../utils/factory";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { uploadFiles } from "../services/upload.service";
import { useState, useRef, useEffect } from "react";
import { IoSend, IoHappyOutline, IoLocationOutline, IoCloseOutline, IoVideocamOutline, IoImageOutline } from "react-icons/io5";
import { MdVideocam, MdImage } from "react-icons/md";
import { toast } from "react-toastify";
import EmojiPicker from "emoji-picker-react";
import { env } from "../config/env";

const Createcomment = ({ type, postId, parentId, button = "reply" }) => {
  const { register, handleSubmit, reset, formState: { errors }, watch, setValue } = useForm();
  const [user, setUserState] = useState(() => getUser() || null);
  const [imageName, setImageName] = useState("");

  useEffect(() => {
    const sync = () => setUserState(getUser() || null);
    window.addEventListener("userUpdated", sync);
    return () => window.removeEventListener("userUpdated", sync);
  }, []);
  const [videoName, setVideoName] = useState("");
  const [isDisabled, setIsDisabled] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationAddress, setLocationAddress] = useState(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log(file);
      setImageName(file.name);
      
      // Add image preview functionality
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error("Image size must be less than 5MB");
        return;
      }
      setImagePreview(URL.createObjectURL(file));
      setVideoPreview(null); // Clear video if image is selected
    }
  };

  const handleVideoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log(file);
      setVideoName(file.name);
      
      // Add video preview functionality
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        toast.error("Video size must be less than 50MB");
        return;
      }
      setVideoPreview(URL.createObjectURL(file));
      setImagePreview(null); // Clear image if video is selected
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeVideo = () => {
    setVideoPreview(null);
    setVideoName("");
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

  const toastMsg = {
    success: "Replied successfully",
    error: "An Error occured 🤯",
  };

  const onSubmit = async (data) => {
    console.log("Form submitted with data:", data);
    console.log("Type:", type);
    console.log("Endpoints:", endpoints);
    
    setIsDisabled(true);
    
    // Create FormData for mixed file handling
    const formData = new FormData();
    
    // Debug: Log all form data
    console.log("Form data received:", data);
    console.log("Image data:", data.image);
    console.log("Video data:", data.video);
    
    // Add text content
    formData.append('content', data.content);
    
    // Add location if available
    if (data.location) {
      formData.append('location', data.location);
    }
    
    // Add post/comment relationships
    if (postId) formData.append('post_id', postId);
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
    
    const endpoint = endpoints[type];
    console.log("Using endpoint:", endpoint);
    
    // Debug: Log FormData contents
    console.log("FormData contents:");
    for (let [key, value] of formData.entries()) {
      console.log(`${key}:`, value);
    }
    
    try {
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
        const errorData = await response.json();
        console.error("Backend error:", errorData);
        throw new Error(`HTTP ${response.status}: ${errorData.detail || 'Unknown error'}`);
      }
      
      const result = await response.json();
      reset();
      setIsDisabled(false);
      setImageName("");
      setVideoName("");
      setImagePreview(null);
      setVideoPreview(null);
    } catch (error) {
      setIsDisabled(false);
      console.error("Post creation error:", error);
    }
  };

  const buttonMsg = type === "post" ? type : button;

  return (
    <>
      {" "}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="p-3 md:p-6 rounded-md flex w-full max-w-full flex-col h-full"
      >
        <div className="flex justify-between gap-2 md:gap-4">
          <div className="flex justify-start gap-2 md:gap-4 flex-1 min-w-0">
            <img
              src={avatarUrl(user)}
              alt=""
              className="w-8 h-8 md:w-10 md:h-10 rounded-full flex-shrink-0"
              onError={(e) => {
                e.target.src = "/avatar.png";
              }}
            />

            <textarea
              type="text"
              placeholder="Share your thoughts"
              className="flex-1 mb-3 text-sm md:text-base placeholder:text-sm md:placeholder:text-base text-inherit bg-inherit outline-0 resize-none min-h-[60px] md:min-h-[80px]"
              {...register("content", { 
                required: "Content is required",
                minLength: {
                  value: 1,
                  message: "Please enter some content"
                }
              })}
            />
          </div>
          
          {errors.content && (
            <div className="text-red-500 text-sm mt-1">
              {errors.content.message}
            </div>
          )}

          <button
            className={
              isDisabled
                ? "blur-[1px] text-center py-2 items-center w-fit px-4 md:px-10 h-[40px] md:h-[50px] capitalize hidden md:flex bg-[#2F4F4F] text-white rounded-full cursor-pointer text-sm md:text-base"
                : "px-4 md:px-10 h-[40px] md:h-[50px] items-center py-2 capitalize hidden md:flex bg-[#2F4F4F] text-white rounded-full cursor-pointer text-sm md:text-base"
            }
            type="submit"
            disabled={isDisabled}
          >
            {isDisabled ? "Posting..." : buttonMsg}
          </button>
          <IoSend
            size={28}
            className={`md:hidden cursor-pointer ${isDisabled ? 'opacity-50' : ''} flex-shrink-0`}
            color="#2F4F4F"
            onClick={handleSubmit(onSubmit)}
            disabled={isDisabled}
          />
        </div>
        <div className="flex justify-start gap-x-2 md:gap-x-4 items-start overflow-x-auto">
          {/* Image Upload */}
          <label htmlFor="image" className="cursor-pointer flex-shrink-0">
            <div className="flex items-center justify-center h-[20px] w-[20px] md:h-[24px] md:w-[24px] text-gray-600 hover:text-blue-600 transition-colors">
              <MdImage className="h-[20px] w-[20px] md:h-[24px] md:w-[24px]" />
            </div>
          </label>

          {/* Video Upload */}
          <label htmlFor="video" className="cursor-pointer flex-shrink-0">
            <div className="flex items-center justify-center h-[20px] w-[20px] md:h-[24px] md:w-[24px] text-gray-600 hover:text-blue-600 transition-colors">
              <MdVideocam className="h-[20px] w-[20px] md:h-[24px] md:w-[24px]" />
            </div>
          </label>

          {/* Emoji Picker */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="flex items-center justify-center h-[20px] w-[20px] md:h-[24px] md:w-[24px] text-gray-600 hover:text-blue-600 transition-colors flex-shrink-0"
          >
            <IoHappyOutline className="h-[20px] w-[20px] md:h-[24px] md:w-[24px]" />
          </button>

          {/* Location */}
          <button
            type="button"
            onClick={handleLocationClick}
            className="flex items-center justify-center h-[20px] w-[20px] md:h-[24px] md:w-[24px] text-gray-600 hover:text-blue-600 transition-colors flex-shrink-0"
          >
            <IoLocationOutline className="h-[20px] w-[20px] md:h-[24px] md:w-[24px]" />
          </button>

          <input
            id="image"
            type="file"
            accept="image/*"
            className="p-0 hidden border rounded focus:border-[#2F4F4F] focus:outline-none"
            ref={fileInputRef}
            {...register("image", {
              required: false,
              onChange: handleImageChange,
            })}
          />

          <input
            id="video"
            type="file"
            accept="video/*"
            className="p-0 hidden border rounded focus:border-[#2F4F4F] focus:outline-none"
            ref={videoInputRef}
            {...register("video", {
              required: false,
              onChange: handleVideoChange,
            })}
          />
          
          {(imageName || videoName) && (
            <p className="text-sm text-gray-600">
              {imageName || videoName}
            </p>
          )}
        </div>

        {/* Image Preview */}
        {imagePreview && (
          <div className="mt-3 md:mt-4 relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full max-h-48 md:max-h-64 object-cover rounded-lg md:rounded-xl"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute top-1 right-1 md:top-2 md:right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
            >
              <IoCloseOutline className="w-3 h-3 md:w-4 md:h-4" />
            </button>
          </div>
        )}

        {/* Video Preview */}
        {videoPreview && (
          <div className="mt-3 md:mt-4 relative">
            <video
              src={videoPreview}
              controls
              className="w-full max-h-48 md:max-h-64 object-cover rounded-lg md:rounded-xl"
            />
            <button
              type="button"
              onClick={removeVideo}
              className="absolute top-1 right-1 md:top-2 md:right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
            >
              <IoCloseOutline className="w-3 h-3 md:w-4 md:h-4" />
            </button>
          </div>
        )}

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="mt-3 md:mt-4 p-3 md:p-4 bg-gray-50 rounded-lg md:rounded-xl border">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <h3 className="text-xs md:text-sm font-medium text-gray-700">Choose an emoji</h3>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <IoCloseOutline className="w-3 h-3 md:w-4 md:h-4" />
              </button>
            </div>
            <EmojiPicker
              onEmojiClick={(emojiData) => addEmoji(emojiData.emoji)}
              width={280}
              height={300}
              searchDisabled={false}
              skinTonesDisabled={false}
              previewConfig={{
                defaultCaption: "Choose an emoji!",
                showPreview: true
              }}
            />
          </div>
        )}

        {/* Location Display */}
        {selectedLocation && (
          <div className="mt-3 md:mt-4 p-2 md:p-3 bg-green-50 border border-green-200 rounded-lg md:rounded-xl">
            <div className="flex items-center space-x-2">
              <IoLocationOutline className="w-3 h-3 md:w-4 md:h-4 text-green-600 flex-shrink-0" />
              <span className="text-xs md:text-sm text-green-700 flex-1 min-w-0">
                Location added: {locationAddress || 'Getting address...'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedLocation(null);
                  setLocationAddress(null);
                  setValue('location', '');
                }}
                className="text-green-600 hover:text-green-800 flex-shrink-0"
              >
                <IoCloseOutline className="w-3 h-3 md:w-4 md:h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Hidden location field */}
        <input
          type="hidden"
          {...register("location")}
        />
      </form>
    </>
  );
};

Createcomment.propTypes = {
  postId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  parentId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  type: PropTypes.string,
  button: PropTypes.string,
  closeModal: PropTypes.func,
};

export default Createcomment;
