import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { IoCamera, IoLocationOutline, IoPersonOutline } from "react-icons/io5";
import { FiMapPin, FiUser, FiMail, FiPhone } from "react-icons/fi";
import { BsBriefcase, BsGlobe } from "react-icons/bs";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { uploadFiles } from "../services/upload.service";
import Modal from "./Modal";

const ProfileEditModal = ({ isOpen, onClose, user, onProfileUpdate }) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [coverImagePreview, setCoverImagePreview] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [profileImageFile, setProfileImageFile] = useState(null);
  const seededForOpen = useRef(false);

  // Seed once per open — do not reset on every user object identity change (blocks typing)
  useEffect(() => {
    if (!isOpen) {
      seededForOpen.current = false;
      return;
    }
    if (!user || seededForOpen.current) return;
    seededForOpen.current = true;
    reset({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      username: user.username || "",
      email: user.email || "",
      bio: user.bio || "",
      profession: user.profession || "",
      country: user.country || "",
      state: user.state || "",
      phone: user.phone || "",
      website: user.website || "",
      location: user.location || "",
    });
    setCoverImagePreview(user.cover || null);
    setProfileImagePreview(user.profile_picture || null);
    setCoverImageFile(null);
    setProfileImageFile(null);
  }, [isOpen, user, reset]);

  const handleCoverImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setCoverImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleProfileImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setProfileImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const payload = {};
      Object.keys(data).forEach((key) => {
        if (data[key] !== undefined && data[key] !== null && data[key] !== "") {
          payload[key] = data[key];
        }
      });

      if (coverImageFile) {
        const coverImageUrl = await uploadFiles(coverImageFile);
        if (coverImageUrl?.[0]) payload.cover = coverImageUrl[0];
      }

      if (profileImageFile) {
        const profileImageUrl = await uploadFiles(profileImageFile);
        if (profileImageUrl?.[0]) payload.profile_pic = profileImageUrl[0];
      }

      const response = await client.run(
        "put",
        `${endpoints?.users}${user.id}/`,
        payload,
        true
      );
      toast.success("Profile updated successfully!");
      onProfileUpdate({
        ...response,
        profile_pic: payload.profile_pic || response?.profile_pic,
        cover: payload.cover || response?.cover,
        profile_picture: response?.profile_picture || payload.profile_pic,
      });
      onClose();
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const fieldClass =
    "w-full h-11 border border-border bg-background text-foreground px-3 pl-10 text-sm focus:outline-none focus:border-primary";

  return (
    <Modal closeFn={onClose} title="Edit profile">
      <form onSubmit={handleSubmit(onSubmit)} className="p-4 sm:p-5 space-y-5">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">Cover image</label>
          <div className="relative h-36 border border-border bg-background overflow-hidden">
            {coverImagePreview ? (
              <img
                src={coverImagePreview}
                alt="Cover preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted">
                <IoCamera size={28} />
              </div>
            )}
            <label className="absolute bottom-2 right-2 h-9 px-3 bg-surface border border-border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer">
              <IoCamera size={14} />
              Change
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverImageChange}
                className="sr-only"
              />
            </label>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 border border-border bg-background overflow-hidden shrink-0">
            {profileImagePreview ? (
              <img
                src={profileImagePreview}
                alt="Profile preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted">
                <IoPersonOutline size={28} />
              </div>
            )}
            <label className="absolute inset-0 flex items-end justify-end p-1 cursor-pointer bg-transparent">
              <span className="h-7 w-7 bg-primary text-primary-foreground inline-flex items-center justify-center">
                <IoCamera size={12} />
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleProfileImageChange}
                className="sr-only"
              />
            </label>
          </div>
          <p className="text-xs text-muted">Tap the camera to change your photo</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">First name *</label>
            <div className="relative">
              <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                {...register("first_name", { required: "First name is required" })}
                className={fieldClass}
                autoComplete="given-name"
              />
            </div>
            {errors.first_name ? (
              <p className="text-destructive text-xs mt-1">{errors.first_name.message}</p>
            ) : null}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Last name *</label>
            <div className="relative">
              <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                {...register("last_name", { required: "Last name is required" })}
                className={fieldClass}
                autoComplete="family-name"
              />
            </div>
            {errors.last_name ? (
              <p className="text-destructive text-xs mt-1">{errors.last_name.message}</p>
            ) : null}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Username *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">@</span>
              <input
                {...register("username", { required: "Username is required" })}
                className={`${fieldClass} pl-8`}
                autoComplete="username"
              />
            </div>
            {errors.username ? (
              <p className="text-destructive text-xs mt-1">{errors.username.message}</p>
            ) : null}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Email *</label>
            <div className="relative">
              <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                type="email"
                {...register("email", { required: "Email is required" })}
                className={fieldClass}
                autoComplete="email"
              />
            </div>
            {errors.email ? (
              <p className="text-destructive text-xs mt-1">{errors.email.message}</p>
            ) : null}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted mb-1">Bio</label>
          <textarea
            {...register("bio")}
            rows={4}
            className="w-full border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:border-primary resize-y min-h-[96px]"
            placeholder="Tell us about yourself…"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Profession</label>
            <div className="relative">
              <BsBriefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input {...register("profession")} className={fieldClass} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Phone</label>
            <div className="relative">
              <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input type="tel" {...register("phone")} className={fieldClass} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Website</label>
            <div className="relative">
              <BsGlobe className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input type="url" {...register("website")} className={fieldClass} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Location</label>
            <div className="relative">
              <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input {...register("location")} className={fieldClass} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Country</label>
            <div className="relative">
              <IoLocationOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input {...register("country")} className={fieldClass} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">State / province</label>
            <div className="relative">
              <IoLocationOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input {...register("state")} className={fieldClass} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 border border-border text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="h-10 px-4 bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
          >
            {isLoading ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ProfileEditModal;
