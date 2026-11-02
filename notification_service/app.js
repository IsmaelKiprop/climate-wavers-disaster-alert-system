import { useQueue } from "./lib/queue.js";
import channels from "./constants/channels.js";
import controller from "./services/controller.js";
import express from "express";

const app = express();
const port = process.env.PORT || 3000;

useQueue(channels.custom_mail, controller.sendCustom);
useQueue(channels.disaster_alert, controller.sendDisasterAlert);
useQueue(channels.forget_password, controller.sendForgetPassword);
useQueue(channels.onboarding, controller.onboardUser);
useQueue(channels.verification, controller.sendVerification);

app.get("/", (req, res) => res.status(200).json({ status: "ok", service: "climate-wavers-notifications" }))
app.get("/status", (req, res)=>res.status(200).send("OK"))

app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`);
});
