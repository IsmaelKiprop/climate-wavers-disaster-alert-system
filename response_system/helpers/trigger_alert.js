const axios = require("axios")
const { sendToQueue } = require("../lib/amqp")
const { getDefaultChannel } = require("../config/channels")
const queues = require("../constants/queues")

const NOTIFY_URL = (process.env.NOTIFICATION_SERVICE_URL || "https://climate-wavers-notifications.onrender.com").replace(/\/$/, "")
const DJANGO_URL = (process.env.DJANGO_API_URL || "https://climate-wavers-api.onrender.com").replace(/\/$/, "")
const SECRET = process.env.NOTIFICATION_SECRET || process.env.SERVER_SECRET || ""

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

async function triggerDisasterAlert({ city, country, disasterType, details, id, vision }) {
  const payload = {
    city,
    country,
    disasterType,
    details,
    id,
    vision: vision?.inference || vision?.label || "",
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
