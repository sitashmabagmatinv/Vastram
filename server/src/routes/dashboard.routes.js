import express from "express";
import { query } from "../config/db.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.get("/summary", authenticate, async (req, res, next) => {
  try {
    if (req.user.role === "customer") {
      const orders = await query(
        `SELECT COUNT(*) AS total_orders,
                SUM(status NOT IN ('completed', 'cancelled')) AS active_orders
         FROM orders o
         JOIN customers c ON c.id = o.customer_id
         WHERE c.user_id = :userId`,
        { userId: req.user.id }
      );
      const measurements = await query(
        `SELECT COUNT(*) AS measurement_profiles
         FROM measurements m
         JOIN customers c ON c.id = m.customer_id
         WHERE c.user_id = :userId`,
        { userId: req.user.id }
      );
      return res.json({ summary: { ...orders[0], ...measurements[0] } });
    }

    const staffFilter = req.user.role === "staff" ? "AND assigned_staff_id = :staffId" : "";
    const orders = await query(
      `SELECT
        COUNT(*) AS total_orders,
        SUM(status NOT IN ('completed', 'cancelled')) AS active_orders,
        SUM(status = 'ready') AS ready_orders
       FROM orders
       WHERE 1=1 ${staffFilter}`,
      { staffId: req.user.id }
    );
    const customers = await query("SELECT COUNT(*) AS total_customers FROM customers");
    const lowStock = await query(
      "SELECT COUNT(*) AS low_stock_count FROM fabrics WHERE active = TRUE AND stock_quantity <= low_stock_threshold"
    );

    res.json({ summary: { ...orders[0], ...customers[0], ...lowStock[0] } });
  } catch (error) {
    next(error);
  }
});

export default router;
