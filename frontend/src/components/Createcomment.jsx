import { useForm } from "react-hook-form";
import PropTypes from "prop-types";
import { getUser, getAuthToken } from "../utils/factory";
import { endpoints } from "../utils/endpoints";
import { uploadFiles } from "../services/upload.service";
import { useState, useRef, useEffect } from "react";
import {
  IoSend,
  IoHappyOutline,
  IoLocationOutline,
  IoCloseOutline,
} from "react-icons/io5";
import { MdVideocam, MdImage } from "react-icons/md";
import { toast } from "react-toastify";
import LazyEmojiPicker from "./LazyEmojiPicker";
import { env } from "../config/env";
import UserAvatar from "./UserAvatar";

const Createcomment = ({ type, postId, parentId, button = "Post", onSuccess }) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    watch,
    setValue,
  } = useForm({
    defaultValues: { content: "", location: "" },
  });
  const [user, setUserState] = useState(() => getUser() || null);
  const [imageName, setImageName] = useState("");
  const [videoName, setVideoName] = useState("");
  const [isDisabled, setIsDisabled] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationAddress, setLocationAddress] = useState(null);
  const [isFocused, setIsFocused] = useState(false);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const textareaRef = useRef(null);

  const contentValue = watch("content") || "";
  const hasContent = contentValue.trim().length > 0 || Boolean(imagePreview || videoPreview);
  const { ref: contentRegisterRef, ...contentRegister } = register("content", {
    validate: (value) => {
      if ((value && value.trim()) || imagePreview || videoPreview) return true;
      return "Write a comment or add a photo";
    },
  });

  useEffect(() => {
    const sync = () => setUserState(getUser() || null);
    window.addEventListener("userUpdated", sync);
    return () => window.removeEventListener("userUpdated", sync);
  }, []);

  useEffect(() => {
    setValue("location", "");
  }, [setValue]);

  const resizeTextarea = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }
    setImageName(file.name);
    setImagePreview(URL.createObjectURL(file));
    setVideoPreview(null);
    setVideoName("");
  };

  const handleVideoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Video size must be less than 50MB");
      return;
    }
    setVideoName(file.name);
    setVideoPreview(URL.createObjectURL(file));
    setImagePreview(null);
    setImageName("");
  };

  const { ref: imageRegisterRef, ...imageRegister } = register("image", {
    required: false,
    onChange: handleImageChange,
  });
  const { ref: videoRegisterRef, ...videoRegister } = register("video", {
    required: false,
    onChange: handleVideoChange,
  });

  const removeImage = () => {
    setImagePreview(null);
    setImageName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeVideo = () => {
    setVideoPreview(null);
    setVideoName("");
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const addEmoji = (emoji) => {
    const currentContent = watch("content") || "";
    const newContent = currentContent + emoji;
    setValue("content", newContent, { shouldValidate: true });
    setShowEmojiPicker(false);
    requestAnimationFrame(() => resizeTextarea(textareaRef.current));
  };

  const reverseGeocode = async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        { headers: { "User-Agent": "ClimateWavers/1.0" } }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.display_name) return data.display_name;
        if (data.address) {
          const address = data.address;
          const parts = [];
          if (address.city) parts.push(address.city);
          else if (address.town) parts.push(address.town);
          else if (address.village) parts.push(address.village);
          if (address.state) parts.push(address.state);
          if (address.country) parts.push(address.country);
          return parts.length > 0 ? parts.join(", ") : `${latitude}, ${longitude}`;
        }
      }
      return `${latitude}, ${longitude}`;
    } catch (error) {
      console.error("Reverse geocoding error:", error);
      return `${latitude}, ${longitude}`;
    }
  };

  const handleLocationClick = async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setSelectedLocation({ latitude, longitude });
        setValue("location", `${latitude}, ${longitude}`);
        const address = await reverseGeocode(latitude, longitude);
        setLocationAddress(address);
        setValue("location", address);
        toast.success("Location added");
      },
      (error) => {
        console.error("Error getting location:", error);
        toast.error("Unable to get your location. Please try again.");
      }
    );
  };

  const clearComposer = () => {
    reset({ content: "", location: "" });
    setImageName("");
    setVideoName("");
    setImagePreview(null);
    setVideoPreview(null);
    setSelectedLocation(null);
    setLocationAddress(null);
    setShowEmojiPicker(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const onSubmit = async (data) => {
    setIsDisabled(true);
    const formData = new FormData();
    formData.append("content", (data.content || "").trim());

    if (data.location) formData.append("location", data.location);
    if (postId) formData.append("post_id", postId);
    if (parentId) formData.append("parent_comment", parentId);

    if (data.image && data.image.length > 0 && data.image[0] instanceof File) {
      const imageUrl = await uploadFiles(data.image[0]);
      if (imageUrl && imageUrl.length > 0) formData.append("image", imageUrl[0]);
    }

    if (data.video && data.video.length > 0 && data.video[0] instanceof File) {
      const videoUrl = await uploadFiles(data.video[0]);
      if (videoUrl && videoUrl.length > 0) formData.append("video", videoUrl[0]);
    }

    const endpoint = endpoints[type];

    try {
      const token = getAuthToken();
      const response = await fetch(`${env.backendUrl}${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      clearComposer();
      toast.success("Comment posted");
      onSuccess?.();
    } catch (error) {
      console.error("Comment creation error:", error);
      toast.error("Could not post comment. Please try again.");
    } finally {
      setIsDisabled(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (hasContent && !isDisabled) handleSubmit(onSubmit)();
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full text-left">
      <div className="flex items-start gap-2.5">
        <UserAvatar
          user={user}
          className="h-9 w-9 shrink-0 mt-0.5"
          textClassName="text-xs"
          alt={user?.first_name || user?.username || "You"}
        />

        <div className="min-w-0 flex-1">
          <div
            className={`flex items-end gap-1 bg-surface-muted border transition-colors ${
              isFocused ? "border-primary/50" : "border-transparent"
            }`}
            style={{ borderRadius: 18 }}
          >
            <textarea
              placeholder="Write a comment..."
              rows={1}
              className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted outline-none resize-none leading-5 max-h-[120px]"
              style={{ borderRadius: 18 }}
              {...contentRegister}
              ref={(el) => {
                contentRegisterRef(el);
                textareaRef.current = el;
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              onInput={(e) => resizeTextarea(e.target)}
            />

            <div className="flex items-center gap-0.5 pr-1.5 pb-1.5 shrink-0">
              <label
                htmlFor="comment-image"
                className="inline-flex h-8 w-8 items-center justify-center text-muted hover:text-primary cursor-pointer"
                style={{ borderRadius: 5 }}
                title="Photo"
              >
                <MdImage className="h-5 w-5" />
              </label>
              <label
                htmlFor="comment-video"
                className="inline-flex h-8 w-8 items-center justify-center text-muted hover:text-primary cursor-pointer"
                style={{ borderRadius: 5 }}
                title="Video"
              >
                <MdVideocam className="h-5 w-5" />
              </label>
              <button
                type="button"
                onClick={() => setShowEmojiPicker((v) => !v)}
                className={`inline-flex h-8 w-8 items-center justify-center hover:text-primary ${
                  showEmojiPicker ? "text-primary" : "text-muted"
                }`}
                style={{ borderRadius: 5 }}
                title="Emoji"
                aria-pressed={showEmojiPicker}
              >
                <IoHappyOutline className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleLocationClick}
                className={`inline-flex h-8 w-8 items-center justify-center hover:text-primary ${
                  selectedLocation ? "text-primary" : "text-muted"
                }`}
                style={{ borderRadius: 5 }}
                title="Location"
              >
                <IoLocationOutline className="h-5 w-5" />
              </button>
              {hasContent ? (
                <button
                  type="submit"
                  disabled={isDisabled}
                  className="inline-flex h-8 w-8 items-center justify-center text-primary hover:bg-primary/10 disabled:opacity-50"
                  style={{ borderRadius: "50%" }}
                  title={button}
                  aria-label={isDisabled ? "Posting" : button}
                >
                  <IoSend className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          {errors.content ? (
            <p className="mt-1.5 px-1 text-xs text-destructive">{errors.content.message}</p>
          ) : (
            <p className="mt-1.5 px-1 text-[11px] text-muted">
              Press Enter to post · Shift+Enter for a new line
            </p>
          )}

          <input
            id="comment-image"
            type="file"
            accept="image/*"
            className="hidden"
            {...imageRegister}
            ref={(el) => {
              fileInputRef.current = el;
              imageRegisterRef(el);
            }}
          />
          <input
            id="comment-video"
            type="file"
            accept="video/*"
            className="hidden"
            {...videoRegister}
            ref={(el) => {
              videoInputRef.current = el;
              videoRegisterRef(el);
            }}
          />

          {(imageName || videoName) && !imagePreview && !videoPreview ? (
            <p className="mt-2 text-xs text-muted">{imageName || videoName}</p>
          ) : null}

          {imagePreview ? (
            <div className="relative mt-2 inline-block max-w-full">
              <img
                src={imagePreview}
                alt="Preview"
                className="max-h-40 max-w-full object-cover border border-border"
                style={{ borderRadius: 5 }}
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-1.5 right-1.5 bg-secondary text-secondary-foreground p-1 hover:opacity-90"
                style={{ borderRadius: "50%" }}
                aria-label="Remove image"
              >
                <IoCloseOutline className="w-4 h-4" />
              </button>
            </div>
          ) : null}

          {videoPreview ? (
            <div className="relative mt-2 inline-block max-w-full">
              <video
                src={videoPreview}
                controls
                className="max-h-40 max-w-full object-cover border border-border"
                style={{ borderRadius: 5 }}
              />
              <button
                type="button"
                onClick={removeVideo}
                className="absolute top-1.5 right-1.5 bg-secondary text-secondary-foreground p-1 hover:opacity-90"
                style={{ borderRadius: "50%" }}
                aria-label="Remove video"
              >
                <IoCloseOutline className="w-4 h-4" />
              </button>
            </div>
          ) : null}

          {showEmojiPicker ? (
            <div className="mt-2 border border-border bg-surface p-2" style={{ borderRadius: 5 }}>
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-medium text-foreground">Emoji</span>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(false)}
                  className="text-muted hover:text-foreground"
                  aria-label="Close emoji picker"
                >
                  <IoCloseOutline className="w-4 h-4" />
                </button>
              </div>
              <LazyEmojiPicker
                onEmojiClick={(emojiData) => addEmoji(emojiData.emoji)}
                width="100%"
                height={280}
                searchDisabled={false}
                skinTonesDisabled={false}
                previewConfig={{
                  defaultCaption: "Pick an emoji",
                  showPreview: true,
                }}
              />
            </div>
          ) : null}

          {selectedLocation ? (
            <div
              className="mt-2 flex items-center gap-2 border border-border bg-surface-muted px-2.5 py-2"
              style={{ borderRadius: 5 }}
            >
              <IoLocationOutline className="w-4 h-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                {locationAddress || "Getting address..."}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedLocation(null);
                  setLocationAddress(null);
                  setValue("location", "");
                }}
                className="shrink-0 text-muted hover:text-foreground"
                aria-label="Remove location"
              >
                <IoCloseOutline className="w-4 h-4" />
              </button>
            </div>
          ) : null}

          <input type="hidden" {...register("location")} />
        </div>
      </div>
    </form>
  );
};

Createcomment.propTypes = {
  postId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  parentId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  type: PropTypes.string,
  button: PropTypes.string,
  closeModal: PropTypes.func,
  onSuccess: PropTypes.func,
};

export default Createcomment;
