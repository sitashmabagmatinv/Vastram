import express from "express";
import { pool, query } from "../config/db.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { httpError } from "../middleware/error.js";

const router = express.Router();

const STATUSES = [
  "received",
  "fabric_selected",
  "cutting",
  "stitching",
  "finishing",
  "quality_check",
  "ready",
  "completed",
  "cancelled"
];

router.use(authenticate);

function orderSelect(where) {
  return `SELECT o.*,
          c.full_name AS customer_name,
          c.user_id AS customer_user_id,
          s.name AS staff_name,
          f.name AS fabric_name,
          f.color AS fabric_color
        FROM orders o
        JOIN customers c ON c.id = o.customer_id
        LEFT JOIN users s ON s.id = o.assigned_staff_id
        LEFT JOIN fabrics f ON f.id = o.primary_fabric_id
        ${where}
        ORDER BY o.updated_at DESC`;
}

async function getOrderForAccess(user, orderId) {
  const rows = await query(orderSelect("WHERE o.id = :id"), { id: orderId });
  const order = rows[0];
  if (!order) return null;
  if (user.role === "admin") return order;
  if (user.role === "staff" && order.assigned_staff_id === user.id) return order;
  if (user.role === "customer" && order.customer_user_id === user.id) return order;
  return false;
}

router.get("/", async (req, res, next) => {
  try {
    let rows;
    if (req.user.role === "admin") {
      rows = await query(orderSelect("WHERE (:status IS NULL OR o.status = :status)"), {
        status: req.query.status || null
      });
    } else if (req.user.role === "staff") {
      rows = await query(
        orderSelect("WHERE o.assigned_staff_id = :staffId AND (:status IS NULL OR o.status = :status)"),
        { staffId: req.user.id, status: req.query.status || null }
      );
    } else {
      rows = await query(
        orderSelect("WHERE c.user_id = :userId AND (:status IS NULL OR o.status = :status)"),
        { userId: req.user.id, status: req.query.status || null }
      );
    }
    res.json({ orders: rows });
  } catch (error) {
    next(error);
  }
});

router.post("/", authorize("admin", "staff"), async (req, res, next) => {
  let connection;

  try {
    connection = await pool.getConnection();
    const {
      customer_id,
      assigned_staff_id,
      measurement_id,
      primary_fabric_id,
      garment_type,
      due_date,
      notes
    } = req.body;

    if (!customer_id || !garment_type) {
      throw httpError(400, "Customer and garment type are required.");
    }

    const orderCode = `VAS-${Date.now().toString().slice(-8)}`;
    const staffId = req.user.role === "staff" ? req.user.id : assigned_staff_id || null;

    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO orders
       (order_code, customer_id, assigned_staff_id, measurement_id, primary_fabric_id, garment_type, due_date, notes, created_by)
       VALUES (:orderCode, :customer_id, :staffId, :measurement_id, :primary_fabric_id, :garment_type, :due_date, :notes, :created_by)`,
      {
        orderCode,
        customer_id,
        staffId,
        measurement_id: measurement_id || null,
        primary_fabric_id: primary_fabric_id || null,
        garment_type,
        due_date: due_date || null,
        notes: notes || null,
        created_by: req.user.id
      }
    );

    await connection.execute(
      "INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES (:orderId, 'received', 'Order created', :changedBy)",
      { orderId: result.insertId, changedBy: req.user.id }
    );

    await connection.commit();

    const rows = await query(orderSelect("WHERE o.id = :id"), { id: result.insertId });
    res.status(201).json({ order: rows[0] });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const order = await getOrderForAccess(req.user, req.params.id);
    if (order === null) throw httpError(404, "Order not found.");
    if (order === false) throw httpError(403, "You cannot access this order.");

    const history = await query(
      `SELECT h.*, u.name AS changed_by_name
       FROM order_status_history h
       LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.order_id = :orderId
       ORDER BY h.created_at ASC`,
      { orderId: req.params.id }
    );
    res.json({ order, history });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", authorize("admin", "staff"), async (req, res, next) => {
  try {
    const order = await getOrderForAccess(req.user, req.params.id);
    if (order === null) throw httpError(404, "Order not found.");
    if (order === false) throw httpError(403, "You cannot update this order.");

    const { measurement_id, primary_fabric_id, garment_type, due_date, notes } = req.body;
    await query(
      `UPDATE orders
       SET measurement_id = COALESCE(:measurement_id, measurement_id),
           primary_fabric_id = COALESCE(:primary_fabric_id, primary_fabric_id),
           garment_type = COALESCE(:garment_type, garment_type),
           due_date = COALESCE(:due_date, due_date),
           notes = COALESCE(:notes, notes)
       WHERE id = :id`,
      {
        id: req.params.id,
        measurement_id: measurement_id ?? null,
        primary_fabric_id: primary_fabric_id ?? null,
        garment_type: garment_type ?? null,
        due_date: due_date ?? null,
        notes: notes ?? null
      }
    );

    const rows = await query(orderSelect("WHERE o.id = :id"), { id: req.params.id });
    res.json({ order: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/status", authorize("admin", "staff"), async (req, res, next) => {
  let connection;

  try {
    connection = await pool.getConnection();
    const { status, note } = req.body;
    if (!STATUSES.includes(status)) {
      throw httpError(400, "Invalid order status.");
    }

    const order = await getOrderForAccess(req.user, req.params.id);
    if (order === null) throw httpError(404, "Order not found.");
    if (order === false) throw httpError(403, "You cannot update this order status.");

    await connection.beginTransaction();
    await connection.execute("UPDATE orders SET status = :status WHERE id = :id", {
      id: req.params.id,
      status
    });
    await connection.execute(
      "INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES (:orderId, :status, :note, :changedBy)",
      {
        orderId: req.params.id,
        status,
        note: note || null,
        changedBy: req.user.id
      }
    );
    await connection.commit();

    const rows = await query(orderSelect("WHERE o.id = :id"), { id: req.params.id });
    res.json({ order: rows[0] });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.patch("/:id/assign", authorize("admin"), async (req, res, next) => {
  try {
    const { assigned_staff_id } = req.body;
    await query("UPDATE orders SET assigned_staff_id = :assigned_staff_id WHERE id = :id", {
      id: req.params.id,
      assigned_staff_id: assigned_staff_id || null
    });
    const rows = await query(orderSelect("WHERE o.id = :id"), { id: req.params.id });
    if (!rows.length) throw httpError(404, "Order not found.");
    res.json({ order: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.STATUSES = STATUSES;

export default router;
