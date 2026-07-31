import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/users.routes.js";
import customerRoutes from "./routes/customers.routes.js";
import orderRoutes from "./routes/orders.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import alertRoutes from "./routes/alerts.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import measurementRoutes from "./routes/measurements.routes.js";
import readyMadeRoutes from "./routes/readyMade.routes.js";
import { errorHandler, notFound } from "./middleware/error.js";

dotenv.config();

const app = express();
const isProduction = process.env.NODE_ENV === "production";

const configuredOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", ...configuredOrigins],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            frameAncestors: ["'none'"]
          }
        }
      : false
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const isLocalDev =
        !isProduction &&
        (/^http:\/\/(localhost|127\.0\.0\.1):5173$/.test(origin) ||
          /^http:\/\/(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+):5173$/.test(origin));

      if (configuredOrigins.includes(origin) || isLocalDev) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked origin: ${origin}`));
    }
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT || 600),
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login/register attempts. Please try again later." }
});

app.use(express.json({ limit: "1mb" }));
app.use("/api", apiLimiter);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "vastram-api" });
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/measurements", measurementRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/fabrics", inventoryRoutes);
app.use("/api/ready-made", readyMadeRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
