import { useEffect, useRef, useState } from "react";
import { IoImageOutline, IoVideocamOutline } from "react-icons/io5";
import { toast } from "react-toastify";
import { client } from "../api";
import { uploadFiles } from "../services/upload.service";
import { endpoints } from "../utils/endpoints";
import { secureMediaUrl } from "../utils/factory";
import { DEFAULT_POST_FONT, postFontStyle } from "../utils/postFonts";
import PostFontPicker from "./PostFontPicker";

const firstUploadUrl = (uploaded) => {
  if (!uploaded) return "";
  if (Array.isArray(uploaded)) return uploaded[0] || "";
  return uploaded;
};

/**
 * Full post/comment editor: text, font, replace/remove image/video/audio, location.
 */
export default function PostEditPanel({
  item,
  itemType = "post",
  onCancel,
  onSaved,
}) {
  const isComment = itemType === "comments";
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const audioInputRef = useRef(null);

  const [content, setContent] = useState("");
  const [fontFamily, setFontFamily] = useState(DEFAULT_POST_FONT);
  const [location, setLocation] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [videoPreview, setVideoPreview] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setContent(item?.content || "");
    setFontFamily(item?.font_family || DEFAULT_POST_FONT);
    setLocation(item?.location || "");
    setImageUrl(item?.image || "");
    setVideoUrl(item?.video || "");
    setAudioUrl(item?.audio || "");
    setImageFile(null);
    setVideoFile(null);
    setAudioFile(null);
    setImagePreview("");
    setVideoPreview("");
  }, [item?.id]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      if (videoPreview) URL.revokeObjectURL(videoPreview);
    };
  }, [imagePreview, videoPreview]);

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setImageUrl("");
    // Prefer one visual media at a time when replacing
    setVideoFile(null);
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoPreview("");
    setVideoUrl("");
  };

  const onPickVideo = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setVideoUrl("");
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview("");
    setImageUrl("");
  };

  const onPickAudio = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAudioFile(file);
    setAudioUrl("");
  };

  const clearImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview("");
    setImageUrl("");
  };

  const clearVideo = () => {
    setVideoFile(null);
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoPreview("");
    setVideoUrl("");
  };

  const clearAudio = () => {
    setAudioFile(null);
    setAudioUrl("");
  };

  const shownImage = imagePreview || (imageUrl ? secureMediaUrl(imageUrl) : "");
  const shownVideo = videoPreview || (videoUrl ? secureMediaUrl(videoUrl) : "");

  const save = async () => {
    const nextContent = String(content || "").trim();
    const willHaveImage = Boolean(imageFile || imageUrl);
    const willHaveVideo = Boolean(videoFile || videoUrl);
    const willHaveAudio = Boolean(audioFile || audioUrl);

    if (!nextContent && !willHaveImage && !willHaveVideo && !willHaveAudio) {
      toast.error("Add text or media before saving.");
      return;
    }

    setSaving(true);
    try {
      let nextImage = imageUrl || "";
      let nextVideo = videoUrl || "";
      let nextAudio = audioUrl || "";

      if (imageFile) {
        const uploaded = await uploadFiles(imageFile);
        nextImage = firstUploadUrl(uploaded);
        if (!nextImage) throw new Error("Image upload failed");
        nextVideo = "";
      }
      if (videoFile) {
        const uploaded = await uploadFiles(videoFile);
        nextVideo = firstUploadUrl(uploaded);
        if (!nextVideo) throw new Error("Video upload failed");
        nextImage = "";
      }
      if (audioFile) {
        const uploaded = await uploadFiles(audioFile);
        nextAudio = firstUploadUrl(uploaded);
        if (!nextAudio) throw new Error("Audio upload failed");
      }

      const payload = {
        content: nextContent,
        image: nextImage || "",
      };

      if (!isComment) {
        payload.video = nextVideo || "";
        payload.audio = nextAudio || "";
        payload.font_family = fontFamily || DEFAULT_POST_FONT;
        payload.location = String(location || "").trim();
      }

      const url = isComment
        ? `${endpoints.comments}${item.id}/`
        : `${endpoints.post}${item.id}/`;
      const updated = await client.run("patch", url, payload, true);
      toast.success(isComment ? "Comment updated" : "Post updated");
      onSaved?.(updated || { ...item, ...payload });
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.message;
      toast.error(typeof detail === "string" ? detail : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        className="w-full px-3 py-2 border border-border bg-background text-foreground text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/25"
        style={postFontStyle(isComment ? item?.font_family : fontFamily)}
        disabled={saving}
        placeholder={isComment ? "Edit comment…" : "Edit your post…"}
      />

      {!isComment ? (
        <PostFontPicker value={fontFamily} onChange={setFontFamily} />
      ) : null}

      {!isComment ? (
        <label className="block">
          <span className="text-xs font-medium text-muted">Location</span>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={saving}
            placeholder="Optional location"
            className="mt-1 w-full px-3 py-2 border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </label>
      ) : null}

      {shownImage ? (
        <div className="relative overflow-hidden border border-border bg-background">
          <img
            src={shownImage}
            alt="Post image"
            className="w-full max-h-[min(50vh,360px)] object-contain"
          />
          <button
            type="button"
            disabled={saving}
            onClick={clearImage}
            className="absolute top-2 right-2 min-h-9 px-3 bg-background/90 border border-border text-sm text-foreground"
          >
            Remove photo
          </button>
        </div>
      ) : null}

      {shownVideo ? (
        <div className="relative overflow-hidden border border-border bg-background">
          <video
            src={shownVideo}
            controls
            className="w-full max-h-[min(50vh,360px)] object-contain"
            preload="metadata"
          />
          <button
            type="button"
            disabled={saving}
            onClick={clearVideo}
            className="absolute top-2 right-2 min-h-9 px-3 bg-background/90 border border-border text-sm text-foreground"
          >
            Remove video
          </button>
        </div>
      ) : null}

      {(audioUrl || audioFile) && !isComment ? (
        <div className="flex flex-wrap items-center gap-2 border border-border bg-background px-3 py-2">
          <audio
            className="min-w-0 flex-1"
            controls
            preload="metadata"
            src={audioFile ? undefined : secureMediaUrl(audioUrl)}
          />
          <span className="text-xs text-muted">
            {audioFile ? audioFile.name : "Audio attached"}
          </span>
          <button
            type="button"
            disabled={saving}
            onClick={clearAudio}
            className="min-h-9 px-3 border border-border text-sm"
          >
            Remove audio
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => imageInputRef.current?.click()}
          className="inline-flex min-h-10 items-center gap-2 px-3 border border-border bg-background text-sm text-foreground"
        >
          <IoImageOutline size={18} />
          {shownImage ? "Replace photo" : "Add photo"}
        </button>
        {!isComment ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => videoInputRef.current?.click()}
            className="inline-flex min-h-10 items-center gap-2 px-3 border border-border bg-background text-sm text-foreground"
          >
            <IoVideocamOutline size={18} />
            {shownVideo ? "Replace video" : "Add video"}
          </button>
        ) : null}
        {!isComment ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => audioInputRef.current?.click()}
            className="inline-flex min-h-10 items-center gap-2 px-3 border border-border bg-background text-sm text-foreground"
          >
            {audioUrl || audioFile ? "Replace audio" : "Add audio"}
          </button>
        ) : null}
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPickImage}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={onPickVideo}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={onPickAudio}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="min-h-10 px-4 bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
          style={{ borderRadius: 5 }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="min-h-10 px-4 border border-border bg-background text-foreground text-sm font-medium disabled:opacity-60"
          style={{ borderRadius: 5 }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
