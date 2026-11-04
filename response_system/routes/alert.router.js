const { Router } = require("express")
const aiService = require("../services/ai.service")

const router = Router()

router.post("/summary", async (req, res) => {
  try {
    const location = req.body?.location || "the reported area"
    const disasterType = req.body?.disasterType || "disaster"
    const isOfficial = Boolean(req.body?.isOfficial)
    const magnitude = req.body?.magnitude
    const magBit =
      magnitude != null && magnitude !== ""
        ? ` Magnitude or intensity note: ${magnitude}.`
        : ""
    const sourceBit = isOfficial
      ? "Treat this as an official-feed operational notice, not a government order."
      : "Treat this as an unconfirmed community report."

    let summary = ""
    try {
      summary = await aiService.generateLiveDisasterResponse(
        `${location}.${magBit} ${sourceBit}`,
        disasterType
      )
    } catch (error) {
      console.log(`alert summary AI failed: ${error.message}`)
    }
    if (!summary || typeof summary !== "string") {
      summary = `${
        isOfficial ? "Official feed" : "Community report"
      }: ${disasterType} near ${location}.${magBit} Follow local emergency instructions. This is not a government emergency warning.`
    }
    return res.json({
      summary: String(summary).trim().slice(0, 600),
      location,
      disasterType,
    })
  } catch (error) {
    console.log(error)
    return res.status(500).json({ error: "summary failed" })
  }
})

module.exports = router
