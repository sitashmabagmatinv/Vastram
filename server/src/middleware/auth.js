import jwt from "jsonwebtoken";
import { query } from "../config/db.js";
import { httpError } from "./error.js";

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (!token) {
      throw httpError(401, "Authentication token is required.");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "development-secret");
    const rows = await query(
      "SELECT id, name, email, role, active FROM users WHERE id = :id LIMIT 1",
      { id: decoded.id }
    );

    if (!rows.length || !rows[0].active) {
      throw httpError(401, "User is inactive or no longer exists.");
    }

    req.user = rows[0];
    next();
  } catch (error) {
    next(error.status ? error : httpError(401, "Invalid or expired authentication token."));
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(httpError(403, "You do not have permission to perform this action."));
    }
    next();
  };
}
