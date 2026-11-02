import { BsImageAlt } from "react-icons/bs";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { uploadFiles } from "../services/upload.service";
import { getUser, setUser } from "../utils/factory";

const UploadCover = () => {
  const navigate = useNavigate();
  const [imagePreview, setImagePreview] = useState(null);
  const [image, setImage] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file)
      setImagePreview(URL.createObjectURL(file));
    } else {
      setImagePreview(null);
      setImage(null);
    }
  };

  const toastMsg = {
    info: "Uploading Image..",
    success: "Profile Image Uploaded Successful 👌",
    error: "An error occured 🤯, try again later",
  };

  const onSubmit = async () => {
    const uploaded_image = await uploadFiles(image);
    try {
      // Extract the first URL from the array
      const coverUrl = uploaded_image && uploaded_image.length > 0 ? uploaded_image[0] : null;
      console.log("Cover image URL:", coverUrl);
      
      const updated = await client.run(
        "patch",
        endpoints?.user,
        { cover: coverUrl },
        true,
        toastMsg,
        false,
        false
      );
      setUser({
        ...(getUser() || {}),
        ...updated,
        cover: coverUrl,
      });
      setImagePreview(null);
      navigate(-1);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="lg:h-[100vh] md:h-[100vh] flex justify-between">
      <div className="bg-[#2F4F4F] h-[100vh] lg:w-[50%] md:w-[50%] hidden md:flex justify-center ">
        <div className="self-end">
          <img src="../../../HandsShow.png" alt="" />
        </div>
      </div>
      <div className="w-[90%] lg:w-[50%] md:w-[50%] grid px-4 place-content-center  max-sm:pt-20 md:pb-44">
        <h1 className="lg:text-[40px] md:text-[40px] text-[24px] font-[bold font-serif text-[#2F4F4F] text-center mb-8">
          Upload Profile Cover
        </h1>

        <div className="bg-gray-200 md:w-[35vw]  w-[80vw] rounded-lg h-[30vh] mb-6 flex justify-center items-center">
          <input
            accept="image/*"
            id="upload-profile-image"
            type="file"
            hidden
            onChange={handleImageChange}
          />

          <label htmlFor="upload-profile-image">
            {imagePreview ? (
              <div className="mb-3">
                <img
                  src={imagePreview}
                  alt="Image Preview"
                  className="w-[]] rounded-lg h-[30vh] py-2 flex justify-center"
                />
              </div>
            ) : (
              <BsImageAlt className="text-6xl text-gray-700" />
            )}
          </label>
        </div>

        <button
          onClick={onSubmit}
          className="bg-[#2F4F4F]  rounded-md text-white py-4 w-[100%]"
        >
          Confirm
        </button>
       
      </div>
    </div>
  );
};

export default UploadCover;
