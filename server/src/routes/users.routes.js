import express from "express";
import bcrypt from "bcryptjs";
import { query } from "../config/db.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { httpError } from "../middleware/error.js";

const router = express.Router();

router.use(authenticate, authorize("admin"));

router.get("/", async (req, res, next) => {
  try {
    const rows = await query(
      "SELECT id, name, email, role, active, created_at FROM users ORDER BY created_at DESC"
    );
    res.json({ users: rows });
  } catch (error) {
    next(error);
  }
});

router.post("/staff", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      throw httpError(400, "Name, email, and password are required.");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (:name, :email, :passwordHash, 'staff')",
      { name, email, passwordHash }
    );

    res.status(201).json({
      user: { id: result.insertId, name, email, role: "staff", active: true }
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      next(httpError(409, "A user with this email already exists."));
    } else {
      next(error);
    }
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const { name, email, active } = req.body;
    const rows = await query("SELECT id FROM users WHERE id = :id", { id: req.params.id });
    if (!rows.length) {
      throw httpError(404, "User not found.");
    }

    await query(
      `UPDATE users
       SET name = COALESCE(:name, name),
           email = COALESCE(:email, email),
           active = COALESCE(:active, active)
       WHERE id = :id`,
      {
        id: req.params.id,
        name: name ?? null,
        email: email ?? null,
        active: typeof active === "boolean" ? active : null
      }
    );

    const updated = await query(
      "SELECT id, name, email, role, active, created_at FROM users WHERE id = :id",
      { id: req.params.id }
    );
    res.json({ user: updated[0] });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (Number(req.params.id) === req.user.id) {
      throw httpError(400, "You cannot deactivate your own account.");
    }

    await query("UPDATE users SET active = FALSE WHERE id = :id", { id: req.params.id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
