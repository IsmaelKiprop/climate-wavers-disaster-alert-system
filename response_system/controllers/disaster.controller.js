const catchAsyncErrors = require("../lib/catchAsync");
const validator = require("../services/validator.service");
const disasterService = require("../services/disaster.service");
const aiService = require("../services/ai.service");
const { recognizeDisasterImage } = require("../helpers/recognize_image");
const { triggerDisasterAlert } = require("../helpers/trigger_alert");

exports.createDisaster = catchAsyncErrors(async (req, res) => {
  const validateResponse = validator.validateCreateDisasterPayload(req.body);
  if (validateResponse.error)
    return res.status(400).json({ message: validateResponse.error.message });
  const disaster = await disasterService.createDisaster({
    ...validateResponse.value,
  });

  let vision = null;
  const imageUrl = Array.isArray(disaster.images) ? disaster.images[0] : disaster.images;
  if (imageUrl) {
    vision = await recognizeDisasterImage(imageUrl);
    if (vision) {
      try {
        await disasterService.updateOne(disaster.id, {
          vision: vision.inference,
          visionLabel: vision.label,
        });
        disaster.vision = vision.inference;
        disaster.visionLabel = vision.label;
        if (!disaster.disasterType && vision.suggestedType) {
          disaster.disasterType = vision.suggestedType;
        }
      } catch (error) {
        console.log(`vision save failed: ${error.message}`);
      }
    }
  }

  const recommendation = aiService.getSafetyRecommendations(
    disaster.disasterType || vision?.suggestedType
  );
  const alert = await triggerDisasterAlert({
    city: disaster.region,
    country: disaster.country,
    disasterType: disaster.disasterType || vision?.suggestedType || "disaster",
    details: disaster.details,
    id: disaster.id,
    vision,
    latitude: disaster.latitude ?? disaster.lat ?? req.body?.latitude,
    longitude: disaster.longitude ?? disaster.lng ?? req.body?.longitude,
    magnitude: disaster.magnitude ?? req.body?.magnitude,
  });
  return res.status(201).json({ disaster, recommendation, vision, alert });
});

exports.getDisasters = catchAsyncErrors(async (req, res) => {
  const { startDate, endDate, type, status } = req.query;
  const page = req.query.page || 1;
  const pageSize = req.query.pageSize || 15;
  let disasters;
  if (startDate) {
    disasters = await disasterService.getByDate(startDate);
    disasters = disasters.filter((disaster) => {
      const dateFactor = disaster.endDate <= (endDate || Date.now());
      const typeFactor = disaster.disasterType.toString() === type.toString();
      const statusFactor = disaster.status === status;
      return (
        dateFactor &&
        (type ? typeFactor : true) &&
        (status ? statusFactor : true)
      );
    });
  }
  if (!disasters) {
    disasters = await disasterService.getDisasters();
  }
  const data = {
    total: disasters.length,
    filters: { startDate, endDate, type, status },
    page,
    pageSize,
    data: disasters.slice(
      (page - 1) * pageSize,
      (page - 1) * pageSize + pageSize
    ),
  };
  return res.status(200).json(data);
});

exports.getDisaster = catchAsyncErrors(async(req, res)=>{
    const {id} = req.params
    const disaster = await disasterService.getById(id)
    if(!disaster)return res.status(404).json({message: "disaster not found"})
    return res.status(200).json(disaster)
})
