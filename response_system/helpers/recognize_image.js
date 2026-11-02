const axios = require("axios")
const config = require("../config/config")

const LABEL_TO_TYPE = [
  { match: /water|flood|sea/i, type: "Floods" },
  { match: /wild\s*fire|urban fire|fire/i, type: "Wildfire" },
  { match: /earthquake/i, type: "Earthquake" },
  { match: /drought/i, type: "Drought" },
  { match: /land\s*slide/i, type: "Landslide" },
  { match: /storm|hurricane|typhoon/i, type: "Storm" },
]

function typeFromVision(label = "") {
  const found = LABEL_TO_TYPE.find((row) => row.match.test(label))
  return found ? found.type : ""
}

async function recognizeDisasterImage(imageUrl) {
  if (!imageUrl) return null
  const endpoint = `${String(config.aiModels.recognition).replace(/\/$/, "")}/inference`
  const httpsUrl = String(imageUrl).replace(/^http:\/\//i, "https://")
  try {
    const response = await axios.post(
      endpoint,
      { imageUrl: httpsUrl },
      { timeout: 30000 }
    )
    const label = response.data?.label || String(response.data?.inference || "").replace(/^AI detected\s+/i, "")
    if (!label) return null
    return {
      inference: response.data?.inference || `AI detected ${label}`,
      label,
      suggestedType: typeFromVision(label),
    }
  } catch (error) {
    console.log(`computer vision failed: ${error.message}`)
    return null
  }
}

module.exports = { recognizeDisasterImage, typeFromVision }
