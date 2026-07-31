import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool, query } from "../config/db.js";
import { authenticate } from "../middleware/auth.js";
import { httpError } from "../middleware/error.js";

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET || "development-secret",
    { expiresIn: "8h" }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: Boolean(user.active)
  };
}

router.post("/register", async (req, res, next) => {
  let connection;

  try {
    connection = await pool.getConnection();
    const { name, email, password, phone, address } = req.body;
    if (!name || !email || !password) {
      throw httpError(400, "Name, email, and password are required.");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await connection.beginTransaction();

    const [result] = await connection.execute(
      "INSERT INTO users (name, email, password_hash, role) VALUES (:name, :email, :passwordHash, 'customer')",
      { name, email, passwordHash }
    );

    await connection.execute(
      "INSERT INTO customers (user_id, full_name, email, phone, address) VALUES (:userId, :name, :email, :phone, :address)",
      {
        userId: result.insertId,
        name,
        email,
        phone: phone || null,
        address: address || null
      }
    );

    await connection.commit();

    const user = { id: result.insertId, name, email, role: "customer", active: true };
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    if (error.code === "ER_DUP_ENTRY") {
      next(httpError(409, "An account with this email already exists."));
    } else {
      next(error);
    }
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw httpError(400, "Email and password are required.");
    }

    const users = await query("SELECT * FROM users WHERE email = :email LIMIT 1", { email });
    const user = users[0];
    if (!user || !user.active) {
      throw httpError(401, "Invalid email or password.");
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      throw httpError(401, "Invalid email or password.");
    }

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.get("/me", authenticate, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
