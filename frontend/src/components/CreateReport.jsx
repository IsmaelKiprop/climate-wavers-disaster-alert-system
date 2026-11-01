import { useForm } from "react-hook-form";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import { useEffect, useState } from "react";
import { BsImageAlt } from "react-icons/bs";
import { Slider } from "@mui/material";
import PropTypes from "prop-types";
import { getLocation } from "../utils/factory";
import { uploadFiles } from "../services/upload.service";
import axios from 'axios'
import { chatbotApiUrl } from '../config/env'

const apiUrl = chatbotApiUrl('/api/v1/disasters')

const CreateReport = ({ closeModal, showRecommendation}) => {
  const { register, handleSubmit, setValue } = useForm();

  const [imagePreview, setImagePreview] = useState(null);
  const [isDisabled, setIsDisabled] = useState(false);
  const [magnitude, setMagnitude] = useState(0);
  const [fileList, setFileList] = useState([]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileList(Array.from(e.target.files));
      setImagePreview(URL.createObjectURL(file));
    } else {
      setImagePreview(null);
    }
  };

  const onSubmit = async (data) => {
    setIsDisabled(true);
    try {
      const images = await uploadFiles(fileList);
      const status = "unconfirmed"
      const reportData = { ...data, images, magnitude, status };
      const {data: resData} = await axios.post(apiUrl, reportData);
      closeModal();
      return resData
    } catch (error) {
      console.error("Error submitting report:", error);
    } finally {
      setIsDisabled(false);
    }
  };

  const severity = [
    {
      value: 0,
      label: "Mild",
    },
    {
      value: 5,
      label: "Moderate",
    },
    {
      value: 10,
      label: "Severe",
    },
  ];

  const [locationInfo, setLocationInfo] = useState();

  useEffect(() => {
    getLocation().then(res => {
      setLocationInfo(res);
      setValue('region', res?.city);
      setValue('country', res?.country);
    });
  }, [setValue]);

  return (
    <div className="md:mb-12  h-[90vh] w-[90vw] md:w-[100%] md:h-[100%] px-12 ">
      <h1 className="lg:text-[40px] md:text-[40px] text-[24px] text-primary font-bold font-serif text-[#2F4F4F] md:text-center text-start md:mb-8 mb-2">
        Report Disaster
      </h1>
      <div className="grid place-content-center">
        <Box
          component="form"
          className="md:w-full w-[70vw]"
          sx={{
            "& > :not(style)": { m: 1, width: "100%" },
          }}
          noValidate
          autoComplete="off"
          onSubmit={handleSubmit(async(data)=>{
            try {
              
            const {recommendation} = await onSubmit(data)
            console.log({data, recommendation})
            showRecommendation(recommendation)
            } catch (error) {
              console.error("create report failed")
            }
          })}
        >
          <div className="justify-between gap-x-2 flex w-full">
            <TextField
              id="outlined-basic"
              label="City/Region"
              variant="outlined"
              color="success"
              className="w-[50%]"
              sx={{ width: "100" }}
              {...register("region", { required: "City/Region is required" })}
              defaultValue={locationInfo?.city}
            />
            <TextField
              id="outlined-basic"
              label="Country"
              variant="outlined"
              color="success"
              className="w-[50%]"
              sx={{ width: "100" }}
              {...register("country", { required: "Country is required" })}
              defaultValue={locationInfo?.country}
            />
          </div>
          <TextField
            id="outlined-basic"
            label="Type of disaster"
            variant="outlined"
            color="success"
            sx={{ width: "50" }}
            {...register("disasterType", { required: "Type of disaster is required" })}
          />
          <div className="px-1">
            <h3 className="text-xl w-[35vw] text-start">Situation</h3>
            <Slider
              aria-label="Custom marks"
              defaultValue={0}
              step={1}
              sx={{ m: 1, width: "100" }}
              valueLabelDisplay="auto"
              marks={severity}
              min={0}
              max={10}
              color="success"
              onChange={(e) => setMagnitude(e.target.value)}
            />
          </div>
          <TextField
            id="outlined-details"
            label="Details"
            sx={{ m: 2, width: "100" }}
            variant="outlined"
            multiline
            rows={4}
            color="success"
            {...register("details", { required: "Please describe the ongoing incident" })}
          />
          <div className="bg-gray-200 w-[40%] rounded-lg h-[30vh] mb-6 flex justify-center items-center">
            <input
              accept="image/*"
              id="upload-profile-image"
              type="file"
              hidden
              onChange={handleImageChange}
            />
            <label htmlFor="upload-profile-image">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-[100%] rounded-lg h-[30vh] py-2 flex justify-center"
                />
              ) : (
                <BsImageAlt className="text-6xl text-gray-700" />
              )}
            </label>
          </div>
          <button
            type="submit"
            className={
              isDisabled
                ? "blur-[1px] bg-[#2F4F4F] rounded-md w-[80%] text-white py-4"
                : "bg-[#2F4F4F] rounded-md w-[80%] text-white py-4"
            }
            disabled={isDisabled}
          >
            {isDisabled ? "Reporting..." : "Report Disaster"}
          </button>
        </Box>
      </div>
    </div>
  );
};

CreateReport.propTypes = {
  closeModal: PropTypes.func,
};

export default CreateReport;
