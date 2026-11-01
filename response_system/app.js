const express = require("express");
require("dotenv").config();
const morgan = require("morgan");
const helmet = require("helmet");
const logger = require("./logger");
const cors = require("cors");
const path = require("path");
const { useQueue } = require("./lib/amqp");
const queues = require("./constants/queues");
const app = express();
const port = process.env.PORT || 3004;
const postsRouter = require("./routes/post.router");
const chatsRouter = require("./routes/chat.router");
const disasterRouter = require('./routes/disaster.router')
const analyzePost = require("./helpers/analyze_post");
const useCron = require("./lib/cron");
const { generateTitle } = require("./helpers/generate_title");
const generateAITips = require("./helpers/generate_ai_tips");
const {
  defaultJobTimeUnit,
  defaultJobTimeValue,
} = require("./constants/defaults");
const { logBuilder } = require("./lib/log");
const buildLog = require("./helpers/build_log");
const swaggerUI = require('swagger-ui-express')
const { swaggerUi, swaggerSpec } = require('./swagger');
const { getPostChannel, getChatChannel, getLogsChannel } = require("./config/channels");

// Use middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(morgan("combined"));
const allowedOrigins = (process.env.CORS_ORIGINS || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.includes("*") ? true : allowedOrigins,
    credentials: true,
  })
);
app.use(express.static(path.join(__dirname, "views")));

//status endpoint
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/status", (req, res) => res.status(200).send("OK"));

app.use("/api/v1/posts", logBuilder.listen("post"), postsRouter);
app.use("/api/v1/chats", chatsRouter);
app.use('/api/v1/disasters', disasterRouter)

useCron(generateAITips, { [defaultJobTimeUnit]: defaultJobTimeValue });
// useCron(generateAITips, {"sec": 30})
useQueue(getPostChannel,queues.analyze_post, analyzePost);
useQueue(getChatChannel,queues.generate_chat_title, generateTitle);
useQueue(getLogsChannel,queues.build_log, buildLog);

app.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
});