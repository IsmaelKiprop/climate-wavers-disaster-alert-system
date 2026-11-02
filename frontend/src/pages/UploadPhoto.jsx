import { BsImageAlt } from "react-icons/bs";
import avatar1 from "../assets/girl-avatar.svg";
import avatar2 from "../assets/boy-avatar.svg";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { uploadFiles } from "../services/upload.service";
import { getUser, setUser } from "../utils/factory";

const UploadPhoto = () => {
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
      const profilePicUrl = uploaded_image && uploaded_image.length > 0 ? uploaded_image[0] : null;
      console.log("Profile picture URL:", profilePicUrl);
      
      const updated = await client.run(
        "patch",
        endpoints?.user,
        { profile_pic: profilePicUrl },
        true,
        toastMsg,
        false,
        false
      );
      setUser({
        ...(getUser() || {}),
        ...updated,
        profile_pic: profilePicUrl,
        profile_picture: updated?.profile_picture || profilePicUrl,
      });
      setImagePreview(null);
      navigate(-1);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="lg:h-[100vh] md:h-[100vh] flex justify-between">
      <div className="bg-[#067d83] h-[100vh] lg:w-[50%] md:w-[50%] hidden md:flex justify-center ">
        <div className="self-end">
          <img src="../../../HandsShow.png" alt="" />
        </div>
      </div>
      <div className="w-[90%] lg:w-[50%] md:w-[50%] grid px-4 place-content-center m-auto pt-20">
        <h1 className="lg:text-[40px] md:text-[40px] text-[24px] font-[bold font-serif text-[#067d83] text-center mb-8">
          Upload Profile Photo
        </h1>

        <div className="bg-gray-200 w-[100%] rounded-lg h-[30vh] mb-6 flex justify-center items-center">
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
          className="bg-[#067d83]  rounded-md text-white py-4 w-[100%]"
        >
          Confirm
        </button>
        <div className="flex items-center w-[100%] justify-between mt-4">
          <p className="border-b border-gray-400 w-[40%]"></p>
          <p>Or</p>
          <p className="border-b border-gray-400 w-[40%]"></p>
        </div>
        <div className="flex  w-[100%] justify-center items-center flex-col text-center">
          <p className="pt-1">Use our Virtual avatar</p>
          <div className="w-[100%] md:w-[70%]  lg:w-[80%]  flex gap-x-4  my-6 justify-between">
            <Link to="/">
              <img src={avatar2} alt="" className="w-[100%]" />
            </Link>
            <Link to="/">
              <img src={avatar1} alt="" className="w-[100%]" />{" "}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadPhoto;
