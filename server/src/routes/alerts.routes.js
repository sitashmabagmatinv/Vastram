import express from "express";
import { query } from "../config/db.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/low-stock", authenticate, authorize("admin", "staff"), async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT *,
        CASE WHEN stock_quantity <= 0 THEN 'Out' ELSE 'Low Stock' END AS stock_status
       FROM fabrics
       WHERE active = TRUE AND stock_quantity <= low_stock_threshold
       ORDER BY stock_quantity ASC, name ASC`
    );
    res.json({ alerts: rows });
  } catch (error) {
    next(error);
  }
});

export default router;
