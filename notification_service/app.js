import { useQueue } from "./lib/queue.js";
import channels from "./constants/channels.js";
import controller from "./services/controller.js";
import config from "./config/config.js";
import express from "express";

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json({ limit: "256kb" }))

useQueue(channels.custom_mail, controller.sendCustom);
useQueue(channels.disaster_alert, controller.sendDisasterAlert);
useQueue(channels.forget_password, controller.sendForgetPassword);
useQueue(channels.onboarding, controller.onboardUser);
useQueue(channels.verification, controller.sendVerification);

app.get("/", (req, res) => res.status(200).json({ status: "ok", service: "climate-wavers-notifications" }))
app.get("/status", (req, res)=>res.status(200).send("OK"))

app.post("/api/v1/mail", async (req, res) => {
  const secret = req.headers["x-internal-secret"]
  if (!secret || secret !== config.server.secret) {
    return res.status(401).json({ error: "unauthorized" })
  }
  const { type, email, emails, data, city } = req.body || {}
  try {
    if (type === "verification") await controller.sendVerification({ email, data })
    else if (type === "forget_password") await controller.sendForgetPassword({ email, data })
    else if (type === "onboarding") await controller.onboardUser({ email, city: data?.city || city })
    else if (type === "custom_mail") await controller.sendCustom({ email, emails, data })
    else if (type === "disaster_alert") await controller.sendDisasterAlert(data || req.body)
    else return res.status(400).json({ error: "unknown type" })
    return res.json({ ok: true })
  } catch (error) {
    console.log(error)
    return res.status(500).json({ error: "mail failed" })
  }
})

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "invalid json" })
  }
  return next(err)
})

app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
  console.log(
    `mail: smtp host=${process.env.MAIL_HOST || "smtp.gmail.com"} user=${Boolean(process.env.MAIL_USER)}`
  )
});
