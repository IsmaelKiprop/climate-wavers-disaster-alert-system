/**
 * Meta WhatsApp Cloud API sender for Climate Wavers disaster alerts.
 * Requires approved message templates in Meta Business Manager.
 */

const GRAPH_VERSION = process.env.META_WA_GRAPH_VERSION || "v21.0"

function configured() {
  return Boolean(process.env.META_WA_TOKEN && process.env.META_WA_PHONE_NUMBER_ID)
}

function normalizePhone(phone) {
  if (!phone) return ""
  const digits = String(phone).replace(/[^\d+]/g, "")
  if (digits.startsWith("+")) return digits.slice(1)
  // Kenya local 07... → 2547...
  if (digits.startsWith("0") && digits.length >= 9) return `254${digits.slice(1)}`
  return digits
}

async function sendTemplate({ to, templateName, languageCode = "en", components = [] }) {
  if (!configured()) {
    console.log("whatsapp skipped: META_WA_TOKEN / META_WA_PHONE_NUMBER_ID not set")
    return { ok: false, skipped: true }
  }
  const phone = normalizePhone(to)
  if (!phone) return { ok: false, error: "missing phone" }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.META_WA_PHONE_NUMBER_ID}/messages`
  const body = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components.length ? { components } : {}),
    },
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.META_WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.log(`whatsapp template failed ${JSON.stringify({ status: response.status, data })}`)
    return { ok: false, status: response.status, data }
  }
  return { ok: true, data }
}

function bodyParams(texts) {
  return {
    type: "body",
    parameters: texts.map((text) => ({
      type: "text",
      text: String(text || "-").slice(0, 320),
    })),
  }
}

async function sendDisasterAlertWhatsApp(payload) {
  const data = payload?.data || payload || {}
  const recipients = [].concat(data.recipients || [])
  if (!recipients.length) return { ok: true, sent: 0 }

  const template = data.template || "disaster_alert_user"
  const language = data.languageCode || process.env.META_WA_TEMPLATE_LANG || "en"

  let sent = 0
  for (const row of recipients) {
    const phone = row.phone || row
    let components = []
    if (template === "phone_verify_otp") {
      const otp = String(data.otp || "")
      components = [
        bodyParams([otp]),
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: otp.slice(0, 15) }],
        },
      ]
    } else {
      components = [
        bodyParams([
          data.disasterType || "disaster",
          data.city || "reported area",
          data.confidence || (data.isOfficial ? "Official feed" : "Community report"),
          data.magnitude != null ? String(data.magnitude) : "-",
          (data.aiSummary || "Follow local emergency instructions.").slice(0, 200),
          data.deepLink || "https://alerts.flowops.africa/disasters",
        ]),
      ]
    }
    try {
      const result = await sendTemplate({
        to: phone,
        templateName: template,
        languageCode: language,
        components,
      })
      if (result.ok) sent += 1
    } catch (error) {
      console.log(`whatsapp send error: ${error.message || error}`)
    }
  }
  return { ok: true, sent, total: recipients.length }
}

export default {
  configured,
  sendTemplate,
  sendDisasterAlertWhatsApp,
  normalizePhone,
}
