import express from "express";
import { pool, query } from "../config/db.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { httpError } from "../middleware/error.js";

const router = express.Router();

router.use(authenticate, authorize("admin", "staff"));

router.get("/", async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT *,
        CASE
          WHEN stock_quantity <= 0 THEN 'Out'
          WHEN stock_quantity <= low_stock_threshold THEN 'Low Stock'
          ELSE 'Available'
        END AS stock_status
       FROM fabrics
       WHERE active = TRUE
       ORDER BY updated_at DESC`
    );
    res.json({ fabrics: rows });
  } catch (error) {
    next(error);
  }
});

router.post("/", authorize("admin"), async (req, res, next) => {
  try {
    const { name, fabric_type, color, unit, stock_quantity, low_stock_threshold } = req.body;
    if (!name || !fabric_type || !color) {
      throw httpError(400, "Fabric name, type, and color are required.");
    }

    const result = await query(
      `INSERT INTO fabrics (name, fabric_type, color, unit, stock_quantity, low_stock_threshold)
       VALUES (:name, :fabric_type, :color, :unit, :stock_quantity, :low_stock_threshold)`,
      {
        name,
        fabric_type,
        color,
        unit: unit || "meters",
        stock_quantity: stock_quantity || 0,
        low_stock_threshold: low_stock_threshold || 5
      }
    );

    const rows = await query("SELECT * FROM fabrics WHERE id = :id", { id: result.insertId });
    res.status(201).json({ fabric: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", authorize("admin"), async (req, res, next) => {
  try {
    const { name, fabric_type, color, unit, stock_quantity, low_stock_threshold } = req.body;
    await query(
      `UPDATE fabrics
       SET name = COALESCE(:name, name),
           fabric_type = COALESCE(:fabric_type, fabric_type),
           color = COALESCE(:color, color),
           unit = COALESCE(:unit, unit),
           stock_quantity = COALESCE(:stock_quantity, stock_quantity),
           low_stock_threshold = COALESCE(:low_stock_threshold, low_stock_threshold)
       WHERE id = :id AND active = TRUE`,
      {
        id: req.params.id,
        name: name ?? null,
        fabric_type: fabric_type ?? null,
        color: color ?? null,
        unit: unit ?? null,
        stock_quantity: stock_quantity ?? null,
        low_stock_threshold: low_stock_threshold ?? null
      }
    );

    const rows = await query("SELECT * FROM fabrics WHERE id = :id", { id: req.params.id });
    if (!rows.length) throw httpError(404, "Fabric not found.");
    res.json({ fabric: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", authorize("admin"), async (req, res, next) => {
  try {
    await query("UPDATE fabrics SET active = FALSE WHERE id = :id", { id: req.params.id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post("/:id/movements", authorize("admin"), async (req, res, next) => {
  let connection;

  try {
    connection = await pool.getConnection();
    const { movement_type, quantity, note } = req.body;
    const amount = Number(quantity);
    if (!["add", "deduct", "adjust"].includes(movement_type) || Number.isNaN(amount)) {
      throw httpError(400, "Valid movement type and quantity are required.");
    }

    await connection.beginTransaction();
    await connection.execute(
      "INSERT INTO inventory_movements (fabric_id, movement_type, quantity, note, created_by) VALUES (:fabricId, :movementType, :quantity, :note, :userId)",
      {
        fabricId: req.params.id,
        movementType: movement_type,
        quantity: amount,
        note: note || null,
        userId: req.user.id
      }
    );

    if (movement_type === "add") {
      await connection.execute(
        "UPDATE fabrics SET stock_quantity = stock_quantity + :quantity WHERE id = :id",
        { id: req.params.id, quantity: amount }
      );
    } else if (movement_type === "deduct") {
      await connection.execute(
        "UPDATE fabrics SET stock_quantity = GREATEST(stock_quantity - :quantity, 0) WHERE id = :id",
        { id: req.params.id, quantity: amount }
      );
    } else {
      await connection.execute("UPDATE fabrics SET stock_quantity = :quantity WHERE id = :id", {
        id: req.params.id,
        quantity: amount
      });
    }

    await connection.commit();
    const rows = await query("SELECT * FROM fabrics WHERE id = :id", { id: req.params.id });
    res.status(201).json({ fabric: rows[0] });
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

router.get("/:id/movements", authorize("admin"), async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT m.*, u.name AS created_by_name
       FROM inventory_movements m
       LEFT JOIN users u ON u.id = m.created_by
       WHERE m.fabric_id = :fabricId
       ORDER BY m.created_at DESC`,
      { fabricId: req.params.id }
    );

    res.json({ movements: rows });
  } catch (error) {
    next(error);
  }
});

export default router;
