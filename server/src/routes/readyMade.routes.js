import express from "express";
import { pool, query } from "../config/db.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { httpError } from "../middleware/error.js";

const router = express.Router();

router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const search = `%${req.query.search || ""}%`;
    const where =
      req.user.role === "customer"
        ? "WHERE active = TRUE AND stock_quantity > 0"
        : "WHERE active = TRUE";

    const rows = await query(
      `SELECT *,
        CASE
          WHEN stock_quantity <= 0 THEN 'Out'
          WHEN stock_quantity <= 2 THEN 'Few Left'
          ELSE 'Available'
        END AS stock_status
       FROM ready_made_items
       ${where}
         AND (name LIKE :search OR category LIKE :search OR size LIKE :search OR color LIKE :search)
       ORDER BY updated_at DESC`,
      { search }
    );

    res.json({ items: rows });
  } catch (error) {
    next(error);
  }
});

router.get("/orders", async (req, res, next) => {
  try {
    const where =
      req.user.role === "customer"
        ? "WHERE c.user_id = :userId"
        : "WHERE 1 = 1";

    const rows = await query(
      `SELECT ro.*,
              r.name AS item_name,
              r.category,
              r.size,
              r.color,
              r.price,
              r.image_url,
              c.full_name AS customer_name
       FROM ready_made_orders ro
       JOIN ready_made_items r ON r.id = ro.item_id
       JOIN customers c ON c.id = ro.customer_id
       ${where}
       ORDER BY ro.updated_at DESC`,
      { userId: req.user.id }
    );

    res.json({ orders: rows });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/orders", authorize("customer"), async (req, res, next) => {
  let connection;

  try {
    const quantity = Math.max(Number(req.body.quantity || 1), 1);
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [customers] = await connection.execute(
      "SELECT id FROM customers WHERE user_id = :userId LIMIT 1",
      { userId: req.user.id }
    );
    if (!customers.length) {
      throw httpError(404, "Customer profile not found.");
    }

    const [items] = await connection.execute(
      "SELECT id, stock_quantity FROM ready_made_items WHERE id = :id AND active = TRUE FOR UPDATE",
      { id: req.params.id }
    );
    if (!items.length) {
      throw httpError(404, "Clothing item not found.");
    }
    if (Number(items[0].stock_quantity) < quantity) {
      throw httpError(400, "Not enough stock is available for this clothing item.");
    }

    await connection.execute(
      "UPDATE ready_made_items SET stock_quantity = stock_quantity - :quantity WHERE id = :id",
      { id: req.params.id, quantity }
    );

    const [result] = await connection.execute(
      `INSERT INTO ready_made_orders (item_id, customer_id, quantity, note)
       VALUES (:itemId, :customerId, :quantity, :note)`,
      {
        itemId: req.params.id,
        customerId: customers[0].id,
        quantity,
        note: req.body.note || null
      }
    );

    await connection.commit();

    const rows = await query(
      `SELECT ro.*, r.name AS item_name, r.category, r.size, r.color, r.price, r.image_url
       FROM ready_made_orders ro
       JOIN ready_made_items r ON r.id = ro.item_id
       WHERE ro.id = :id`,
      { id: result.insertId }
    );
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

router.patch("/orders/:id/status", authorize("admin", "staff"), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["requested", "confirmed", "ready_for_pickup", "completed", "cancelled"].includes(status)) {
      throw httpError(400, "Invalid clothing order status.");
    }

    await query("UPDATE ready_made_orders SET status = :status WHERE id = :id", {
      id: req.params.id,
      status
    });

    const rows = await query(
      `SELECT ro.*,
              r.name AS item_name,
              r.category,
              r.size,
              r.color,
              r.price,
              r.image_url,
              c.full_name AS customer_name
       FROM ready_made_orders ro
       JOIN ready_made_items r ON r.id = ro.item_id
       JOIN customers c ON c.id = ro.customer_id
       WHERE ro.id = :id`,
      { id: req.params.id }
    );

    if (!rows.length) throw httpError(404, "Clothing order not found.");
    res.json({ order: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.post("/", authorize("admin"), async (req, res, next) => {
  try {
    const { name, category, size, color, price, stock_quantity, image_url, description } = req.body;
    if (!name || !category || !size || !color) {
      throw httpError(400, "Name, category, size, and color are required.");
    }

    const result = await query(
      `INSERT INTO ready_made_items
       (name, category, size, color, price, stock_quantity, image_url, description)
       VALUES (:name, :category, :size, :color, :price, :stock_quantity, :image_url, :description)`,
      {
        name,
        category,
        size,
        color,
        price: price || null,
        stock_quantity: stock_quantity || 0,
        image_url: image_url || null,
        description: description || null
      }
    );

    const rows = await query("SELECT * FROM ready_made_items WHERE id = :id", { id: result.insertId });
    res.status(201).json({ item: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", authorize("admin"), async (req, res, next) => {
  try {
    const { name, category, size, color, price, stock_quantity, image_url, description } = req.body;
    await query(
      `UPDATE ready_made_items
       SET name = COALESCE(:name, name),
           category = COALESCE(:category, category),
           size = COALESCE(:size, size),
           color = COALESCE(:color, color),
           price = COALESCE(:price, price),
           stock_quantity = COALESCE(:stock_quantity, stock_quantity),
           image_url = COALESCE(:image_url, image_url),
           description = COALESCE(:description, description)
       WHERE id = :id AND active = TRUE`,
      {
        id: req.params.id,
        name: name ?? null,
        category: category ?? null,
        size: size ?? null,
        color: color ?? null,
        price: price ?? null,
        stock_quantity: stock_quantity ?? null,
        image_url: image_url ?? null,
        description: description ?? null
      }
    );

    const rows = await query("SELECT * FROM ready_made_items WHERE id = :id", { id: req.params.id });
    if (!rows.length) throw httpError(404, "Ready-made item not found.");
    res.json({ item: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", authorize("admin"), async (req, res, next) => {
  try {
    await query("UPDATE ready_made_items SET active = FALSE WHERE id = :id", { id: req.params.id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
