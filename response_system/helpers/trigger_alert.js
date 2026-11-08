const axios = require("axios")
const { sendToQueue } = require("../lib/amqp")
const { getDefaultChannel } = require("../config/channels")
const queues = require("../constants/queues")
const aiService = require("../services/ai.service")

const NOTIFY_URL = (process.env.NOTIFICATION_SERVICE_URL || "https://climate-wavers-notifications.onrender.com").replace(/\/$/, "")
const DJANGO_URL = (process.env.DJANGO_API_URL || "https://climate-wavers-api.onrender.com").replace(/\/$/, "")
const SECRET = process.env.NOTIFICATION_SECRET || process.env.SERVER_SECRET || ""
const FRONTEND = (process.env.FRONTEND_URL || "https://alerts.flowops.africa").replace(/\/$/, "")

async function postJson(url, body) {
  const response = await axios.post(url, body, {
    timeout: 25000,
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": SECRET,
    },
  })
  return response.data
}

async function triggerDisasterAlert({
  city,
  country,
  disasterType,
  details,
  id,
  vision,
  latitude,
  longitude,
  magnitude,
}) {
  const place = [city, country].filter(Boolean).join(", ") || "an unspecified location"
  let aiSummary = ""
  try {
    aiSummary = await aiService.generateLiveDisasterResponse(place, disasterType || "disaster")
  } catch (error) {
    console.log(`alert AI summary failed: ${error.message}`)
  }

  const payload = {
    city,
    country,
    disasterType,
    details,
    id,
    vision: vision?.inference || vision?.label || "",
    latitude,
    longitude,
    magnitude,
    isOfficial: false,
    aiSummary: typeof aiSummary === "string" ? aiSummary.slice(0, 600) : "",
    deepLink: `${FRONTEND}/disasters`,
    confidence: "Community report — unconfirmed",
  }
  const result = { queue: false, mail: false, inApp: false }

  try {
    await sendToQueue(getDefaultChannel, queues.disaster_alert, payload)
    result.queue = true
  } catch (error) {
    console.log(`alert queue failed: ${error.message}`)
  }

  try {
    await postJson(`${NOTIFY_URL}/api/v1/mail`, {
      type: "disaster_alert",
      data: payload,
    })
    result.mail = true
  } catch (error) {
    console.log(`alert mail failed: ${error.message}`)
  }

  try {
    await postJson(`${DJANGO_URL}/api/v1/alerts/fanout/`, payload)
    result.inApp = true
  } catch (error) {
    console.log(`in-app alert failed: ${error.message}`)
  }

  return result
}

module.exports = { triggerDisasterAlert }
