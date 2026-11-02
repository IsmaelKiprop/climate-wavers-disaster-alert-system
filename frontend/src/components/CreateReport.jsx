import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useQueryClient } from "@tanstack/react-query";
import { getLocation } from "../utils/factory";
import { uploadFiles } from "../services/upload.service";
import { prependCachedDisaster } from "../utils/apiData";
import { recognizeReportImage } from "../utils/vision";
import axios from "axios";
import { chatbotApiUrl } from "../config/env";

const apiUrl = chatbotApiUrl("/api/v1/disasters");

const TYPES = ["Floods", "Earthquake", "Wildfire", "Storm", "Drought", "Landslide", "Other"];

const CreateReport = ({ onSubmitted }) => {
  const queryClient = useQueryClient();
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [disasterType, setDisasterType] = useState("Floods");
  const [details, setDetails] = useState("");
  const [magnitude, setMagnitude] = useState(5);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [vision, setVision] = useState(null);
  const [visionStatus, setVisionStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getLocation().then((info) => {
      if (info?.city) setRegion((current) => current || info.city);
      if (info?.country) setCountry((current) => current || info.country);
    });
  }, []);

  const onFile = async (event) => {
    const next = event.target.files?.[0];
    if (!next) return;
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setVision(null);
    setVisionStatus("Computer vision is reading this photo...");
    try {
      const result = await recognizeReportImage(next);
      setVision(result);
      if (result.suggestedType) setDisasterType(result.suggestedType);
      setVisionStatus(result.inference || "Photo analyzed.");
    } catch (err) {
      setVisionStatus(err.message || "Computer vision could not read this photo. You can still submit.");
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const images = file ? await uploadFiles([file]) : [];
      const { data } = await axios.post(apiUrl, {
        region,
        country,
        disasterType,
        details,
        magnitude,
        status: "unconfirmed",
        images,
      });
      if (data?.disaster) {
        prependCachedDisaster(data.disaster);
        queryClient.invalidateQueries({ queryKey: ["liveDisasters"] });
      }
      onSubmitted?.({
        ...data,
        vision: data.vision || vision,
      });
    } catch (err) {
      console.error(err);
      setError("We could not submit the report. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="p-4 sm:p-5 space-y-4" onSubmit={onSubmit}>
      <p className="text-sm text-muted">
        Reports stay unconfirmed until they are reviewed. Computer vision reads the photo, then we send alerts for that city.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="font-medium">City / region</span>
          <input
            className="mt-1 h-11 w-full px-3 border border-border bg-background"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Country</span>
          <input
            className="mt-1 h-11 w-full px-3 border border-border bg-background"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            required
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="font-medium">Disaster type</span>
        <select
          className="mt-1 h-11 w-full px-3 border border-border bg-background"
          value={disasterType}
          onChange={(event) => setDisasterType(event.target.value)}
        >
          {TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="font-medium">What is happening</span>
        <textarea
          className="mt-1 w-full min-h-[96px] p-3 border border-border bg-background"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          required
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">Severity: {magnitude}/10</span>
        <input
          type="range"
          min="0"
          max="10"
          value={magnitude}
          onChange={(event) => setMagnitude(Number(event.target.value))}
          className="mt-2 w-full"
        />
      </label>

      <div>
        <label className="block text-sm font-medium mb-2" htmlFor="report-photo">
          Photo
        </label>
        <input
          id="report-photo"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFile}
          className="block w-full text-sm"
        />
        {preview ? (
          <img src={preview} alt="Report preview" className="mt-3 w-full h-40 object-cover border border-border bg-background" />
        ) : (
          <p className="mt-2 text-sm text-muted">Add a photo so computer vision can classify the scene.</p>
        )}
        {visionStatus ? <p className="mt-2 text-sm text-foreground">{visionStatus}</p> : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full min-h-11 bg-primary text-primary-foreground font-medium hover:bg-primary-dark disabled:opacity-60"
      >
        {busy ? "Submitting report..." : "Submit report"}
      </button>
    </form>
  );
};

CreateReport.propTypes = {
  onSubmitted: PropTypes.func,
};

export default CreateReport;
