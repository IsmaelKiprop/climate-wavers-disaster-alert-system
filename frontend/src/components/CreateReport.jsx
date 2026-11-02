import { useForm } from "react-hook-form";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import { useEffect, useState } from "react";
import { BsImageAlt } from "react-icons/bs";
import { Slider } from "@mui/material";
import PropTypes from "prop-types";
import { useQueryClient } from "@tanstack/react-query";
import { getLocation } from "../utils/factory";
import { uploadFiles } from "../services/upload.service";
import { prependCachedDisaster } from "../utils/apiData";
import axios from 'axios'
import { chatbotApiUrl } from '../config/env'

const apiUrl = chatbotApiUrl('/api/v1/disasters')

const CreateReport = ({ closeModal, showRecommendation, onSubmitted }) => {
  const { register, handleSubmit, setValue } = useForm();

  const queryClient = useQueryClient();
  const [imagePreview, setImagePreview] = useState(null);
  const [isDisabled, setIsDisabled] = useState(false);
  const [submitError, setSubmitError] = useState("");
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
    setSubmitError("");
    try {
      const images = fileList.length ? await uploadFiles(fileList) : [];
      const reportData = { ...data, images, magnitude, status: "unconfirmed" };
      const { data: resData } = await axios.post(apiUrl, reportData);
      if (resData?.disaster) {
        prependCachedDisaster(resData.disaster);
        queryClient.invalidateQueries({ queryKey: ["liveDisasters"] });
      }
      onSubmitted?.(resData);
      showRecommendation?.(resData?.recommendation);
      closeModal?.();
      return resData;
    } catch (error) {
      console.error("Error submitting report:", error);
      setSubmitError("We could not submit the report. Please try again.");
      return null;
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
          onSubmit={handleSubmit(onSubmit)}
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
          {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
          <button
            type="submit"
            className="bg-primary text-primary-foreground w-[80%] py-4 disabled:opacity-60"
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
  showRecommendation: PropTypes.func,
  onSubmitted: PropTypes.func,
};

export default CreateReport;
