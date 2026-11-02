import axios from "axios"

// import { Cloudinary} from "@cloudinary/url-gen"

// const cloudName = import.meta.env.VITE_APP_CLOUDINARY_CLOUD_NAME
// const apiKey = import.meta.env.VITE_APP_CLOUDINARY_API_KEY
// const apiSecret = import.meta.env.VITE_APP_CLOUDINARY_API_SECRET

const CLOUDINARY_PRESET = "thyh7ivb"
const CLOUDINARY_CLOUD_NAME = "lahri"

// Get the appropriate Cloudinary endpoint based on file type
const getCloudinaryEndpoint = (fileType) => {
    if (fileType.startsWith('image/')) {
        return `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
    } else if (fileType.startsWith('video/')) {
        return `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;
    } else if (fileType.startsWith('audio/')) {
        return `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`; // Audio files use video endpoint
    } else {
        return `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`; // Fallback for other files
    }
};

export const uploadFiles = async (fileList) => {
    if (!Array.isArray(fileList)) {
        fileList = [fileList];
    }

    // Filter out invalid files
    const validFiles = fileList.filter(file => {
        if (!file || !(file instanceof File)) {
            console.warn("Invalid file object:", file);
            return false;
        }
        if (file.size === 0) {
            console.warn("Empty file:", file.name);
            return false;
        }
        return true;
    });

    if (validFiles.length === 0) {
        console.warn("No valid files to upload");
        return [];
    }

    const promises = validFiles.map((file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", CLOUDINARY_PRESET);

        // Get the appropriate endpoint based on file type
        const endpoint = getCloudinaryEndpoint(file.type);
        
        console.log(`Uploading ${file.type} file (${file.size} bytes) to: ${endpoint}`);

        return axios.post(endpoint, formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    });

    try {
        const responses = await Promise.all(promises);
        return responses.map((response) => {
            const payload = response.data || {};
            const url = payload.secure_url || payload.url || "";
            return String(url).replace(/^http:\/\//i, "https://");
        }).filter(Boolean);
    } catch (error) {
        console.error("Error uploading files:", error);
        console.error("Error details:", error.response?.data);
        throw error;
    }
};