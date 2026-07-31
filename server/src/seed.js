import bcrypt from "bcryptjs";
import { pool } from "./config/db.js";

async function upsertUser(connection, user) {
  const passwordHash = await bcrypt.hash(user.password, 10);
  const [existing] = await connection.execute("SELECT id FROM users WHERE email = :email LIMIT 1", {
    email: user.email
  });

  if (existing.length) {
    return existing[0].id;
  }

  const [result] = await connection.execute(
    "INSERT INTO users (name, email, password_hash, role) VALUES (:name, :email, :passwordHash, :role)",
    { ...user, passwordHash }
  );
  return result.insertId;
}

async function seed() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const adminId = await upsertUser(connection, {
      name: "Vastram Admin",
      email: "admin@vastram.local",
      password: "Admin@123",
      role: "admin"
    });

    const staffId = await upsertUser(connection, {
      name: "Maya Tailor",
      email: "staff@vastram.local",
      password: "Staff@123",
      role: "staff"
    });

    const customerUserId = await upsertUser(connection, {
      name: "Aarati Shrestha",
      email: "customer@vastram.local",
      password: "Customer@123",
      role: "customer"
    });

    const [customerRows] = await connection.execute(
      "SELECT id FROM customers WHERE user_id = :userId LIMIT 1",
      { userId: customerUserId }
    );

    let customerId = customerRows[0]?.id;
    if (!customerId) {
      const [customerResult] = await connection.execute(
        "INSERT INTO customers (user_id, full_name, email, phone, address, notes) VALUES (:userId, 'Aarati Shrestha', 'customer@vastram.local', '+977-9800000000', 'Lazimpat, Kathmandu', 'Prefers minimal blouse fittings.')",
        { userId: customerUserId }
      );
      customerId = customerResult.insertId;
    }

    const [measurementRows] = await connection.execute(
      "SELECT id FROM measurements WHERE customer_id = :customerId LIMIT 1",
      { customerId }
    );

    let measurementId = measurementRows[0]?.id;
    if (!measurementId) {
      const [measurementResult] = await connection.execute(
        `INSERT INTO measurements
         (customer_id, label, bust, waist, hips, shoulder, sleeve, length, neck, inseam, notes, created_by, updated_by)
         VALUES (:customerId, 'Blouse standard', 34, 28, 36, 14, 21, 23, 12, 29, 'Measured at first fitting.', :adminId, :adminId)`,
        { customerId, adminId }
      );
      measurementId = measurementResult.insertId;
    }

    const [fabricRows] = await connection.execute("SELECT id FROM fabrics WHERE name = 'Banarasi Silk' LIMIT 1");
    let fabricId = fabricRows[0]?.id;
    if (!fabricId) {
      const [fabricResult] = await connection.execute(
        `INSERT INTO fabrics (name, fabric_type, color, unit, stock_quantity, low_stock_threshold)
         VALUES ('Banarasi Silk', 'Silk', 'Marigold', 'meters', 4, 5),
                ('Cotton Poplin', 'Cotton', 'Ivory', 'meters', 22, 6),
                ('Dhaka Weave', 'Traditional weave', 'Crimson', 'meters', 9, 4)`
      );
      fabricId = fabricResult.insertId;
    }

    const [orderRows] = await connection.execute("SELECT id FROM orders WHERE order_code = 'VAS-DEMO-001' LIMIT 1");
    if (!orderRows.length) {
      const [orderResult] = await connection.execute(
        `INSERT INTO orders
         (order_code, customer_id, assigned_staff_id, measurement_id, primary_fabric_id, garment_type, due_date, status, notes, created_by)
         VALUES ('VAS-DEMO-001', :customerId, :staffId, :measurementId, :fabricId, 'Sari blouse', DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY), 'cutting', 'Urgent festival order.', :adminId)`,
        { customerId, staffId, measurementId, fabricId, adminId }
      );
      await connection.execute(
        "INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES (:orderId, 'received', 'Demo order created', :adminId), (:orderId, 'cutting', 'Fabric prepared for cutting', :staffId)",
        { orderId: orderResult.insertId, adminId, staffId }
      );
    }

    const readyMadeItems = [
      ["Ivory Kurta Set", "Kurta set", "M", "Ivory", 4200, 3, "https://images.unsplash.com/photo-1603217192097-13c306522271?auto=format&fit=crop&w=900&q=80", "Ready-to-wear cotton kurta set for everyday boutique wear."],
      ["Crimson Sari Blouse", "Blouse", "S", "Crimson", 2600, 2, "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=900&q=80", "Finished blouse piece available for immediate fitting."],
      ["Dhaka Waistcoat", "Waistcoat", "L", "Multicolor", 3800, 1, "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=900&q=80", "Traditional-pattern waistcoat stocked for walk-in customers."],
      ["Sage Linen Co-ord", "Co-ord set", "M", "Sage", 5200, 4, "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80", "Soft linen two-piece set available for same-day purchase."],
      ["Black Formal Kurta", "Kurta", "L", "Black", 3400, 5, "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80", "Minimal formal kurta with clean finishing."],
      ["Rose Embroidered Dupatta", "Dupatta", "Free size", "Rose", 1800, 6, "https://images.unsplash.com/photo-1542060748-10c28b62716f?auto=format&fit=crop&w=900&q=80", "Light embroidered dupatta for festive styling."],
      ["Navy Cotton Blouse", "Blouse", "M", "Navy", 2400, 2, "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=900&q=80", "Cotton blouse piece ready for quick alteration."],
      ["Marigold Festival Set", "Festival set", "S", "Marigold", 6100, 2, "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80", "Bright festive set prepared for immediate fitting."]
    ];

    for (const [name, category, size, color, price, stock, imageUrl, description] of readyMadeItems) {
      const [existingReadyItem] = await connection.execute(
        "SELECT id FROM ready_made_items WHERE name = :name LIMIT 1",
        { name }
      );

      if (!existingReadyItem.length) {
        await connection.execute(
          `INSERT INTO ready_made_items
           (name, category, size, color, price, stock_quantity, image_url, description)
           VALUES (:name, :category, :size, :color, :price, :stock, :imageUrl, :description)`,
          { name, category, size, color, price, stock, imageUrl, description }
        );
      }
    }

    await connection.commit();
    console.log("Seed data created.");
  } catch (error) {
    await connection.rollback();
    console.error(error);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

seed();
