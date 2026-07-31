import express from "express";
import { query } from "../config/db.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { httpError } from "../middleware/error.js";

const router = express.Router();

router.use(authenticate);

async function getCustomerAccess(user, customerId) {
  if (user.role === "admin") return true;

  if (user.role === "customer") {
    const rows = await query("SELECT id FROM customers WHERE id = :customerId AND user_id = :userId", {
      customerId,
      userId: user.id
    });
    return rows.length > 0;
  }

  const rows = await query(
    "SELECT id FROM orders WHERE customer_id = :customerId AND assigned_staff_id = :staffId LIMIT 1",
    { customerId, staffId: user.id }
  );
  return rows.length > 0;
}

router.get("/", async (req, res, next) => {
  try {
    const search = `%${req.query.search || ""}%`;
    let rows;

    if (req.user.role === "admin") {
      rows = await query(
        `SELECT c.*, u.email AS account_email
         FROM customers c
         LEFT JOIN users u ON u.id = c.user_id
         WHERE c.full_name LIKE :search OR c.phone LIKE :search OR c.email LIKE :search
         ORDER BY c.updated_at DESC`,
        { search }
      );
    } else if (req.user.role === "staff") {
      rows = await query(
        `SELECT DISTINCT c.*
         FROM customers c
         JOIN orders o ON o.customer_id = c.id
         WHERE o.assigned_staff_id = :staffId
           AND (c.full_name LIKE :search OR c.phone LIKE :search OR c.email LIKE :search)
         ORDER BY c.updated_at DESC`,
        { staffId: req.user.id, search }
      );
    } else {
      rows = await query("SELECT * FROM customers WHERE user_id = :userId", { userId: req.user.id });
    }

    res.json({ customers: rows });
  } catch (error) {
    next(error);
  }
});

router.post("/", authorize("admin", "staff"), async (req, res, next) => {
  try {
    const { full_name, phone, email, address, notes } = req.body;
    if (!full_name) {
      throw httpError(400, "Customer full name is required.");
    }

    const result = await query(
      "INSERT INTO customers (full_name, phone, email, address, notes) VALUES (:full_name, :phone, :email, :address, :notes)",
      {
        full_name,
        phone: phone || null,
        email: email || null,
        address: address || null,
        notes: notes || null
      }
    );

    const rows = await query("SELECT * FROM customers WHERE id = :id", { id: result.insertId });
    res.status(201).json({ customer: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (!(await getCustomerAccess(req.user, req.params.id))) {
      throw httpError(403, "You cannot access this customer profile.");
    }

    const rows = await query("SELECT * FROM customers WHERE id = :id", { id: req.params.id });
    if (!rows.length) {
      throw httpError(404, "Customer not found.");
    }
    res.json({ customer: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", authorize("admin", "staff"), async (req, res, next) => {
  try {
    if (!(await getCustomerAccess(req.user, req.params.id))) {
      throw httpError(403, "You cannot update this customer profile.");
    }

    const { full_name, phone, email, address, notes } = req.body;
    await query(
      `UPDATE customers
       SET full_name = COALESCE(:full_name, full_name),
           phone = COALESCE(:phone, phone),
           email = COALESCE(:email, email),
           address = COALESCE(:address, address),
           notes = COALESCE(:notes, notes)
       WHERE id = :id`,
      {
        id: req.params.id,
        full_name: full_name ?? null,
        phone: phone ?? null,
        email: email ?? null,
        address: address ?? null,
        notes: notes ?? null
      }
    );

    const rows = await query("SELECT * FROM customers WHERE id = :id", { id: req.params.id });
    res.json({ customer: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/measurements", async (req, res, next) => {
  try {
    if (!(await getCustomerAccess(req.user, req.params.id))) {
      throw httpError(403, "You cannot access these measurements.");
    }

    const rows = await query(
      "SELECT * FROM measurements WHERE customer_id = :customerId ORDER BY updated_at DESC",
      { customerId: req.params.id }
    );
    res.json({ measurements: rows });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/measurements", authorize("admin", "staff"), async (req, res, next) => {
  try {
    if (!(await getCustomerAccess(req.user, req.params.id))) {
      throw httpError(403, "You cannot add measurements for this customer.");
    }

    const fields = {
      customer_id: req.params.id,
      label: req.body.label || "Standard profile",
      bust: req.body.bust || null,
      waist: req.body.waist || null,
      hips: req.body.hips || null,
      shoulder: req.body.shoulder || null,
      sleeve: req.body.sleeve || null,
      length: req.body.length || null,
      neck: req.body.neck || null,
      inseam: req.body.inseam || null,
      notes: req.body.notes || null,
      created_by: req.user.id,
      updated_by: req.user.id
    };

    const result = await query(
      `INSERT INTO measurements
       (customer_id, label, bust, waist, hips, shoulder, sleeve, length, neck, inseam, notes, created_by, updated_by)
       VALUES (:customer_id, :label, :bust, :waist, :hips, :shoulder, :sleeve, :length, :neck, :inseam, :notes, :created_by, :updated_by)`,
      fields
    );

    const rows = await query("SELECT * FROM measurements WHERE id = :id", { id: result.insertId });
    res.status(201).json({ measurement: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.patch("/measurements/:id", authorize("admin", "staff"), async (req, res, next) => {
  try {
    const existing = await query("SELECT * FROM measurements WHERE id = :id", { id: req.params.id });
    if (!existing.length) {
      throw httpError(404, "Measurement not found.");
    }

    if (!(await getCustomerAccess(req.user, existing[0].customer_id))) {
      throw httpError(403, "You cannot update this measurement.");
    }

    await query(
      `UPDATE measurements
       SET label = COALESCE(:label, label),
           bust = COALESCE(:bust, bust),
           waist = COALESCE(:waist, waist),
           hips = COALESCE(:hips, hips),
           shoulder = COALESCE(:shoulder, shoulder),
           sleeve = COALESCE(:sleeve, sleeve),
           length = COALESCE(:length, length),
           neck = COALESCE(:neck, neck),
           inseam = COALESCE(:inseam, inseam),
           notes = COALESCE(:notes, notes),
           updated_by = :updated_by
       WHERE id = :id`,
      {
        id: req.params.id,
        label: req.body.label ?? null,
        bust: req.body.bust ?? null,
        waist: req.body.waist ?? null,
        hips: req.body.hips ?? null,
        shoulder: req.body.shoulder ?? null,
        sleeve: req.body.sleeve ?? null,
        length: req.body.length ?? null,
        neck: req.body.neck ?? null,
        inseam: req.body.inseam ?? null,
        notes: req.body.notes ?? null,
        updated_by: req.user.id
      }
    );

    const rows = await query("SELECT * FROM measurements WHERE id = :id", { id: req.params.id });
    res.json({ measurement: rows[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
