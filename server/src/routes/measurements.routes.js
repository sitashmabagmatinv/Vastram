import express from "express";
import { query } from "../config/db.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { httpError } from "../middleware/error.js";

const router = express.Router();

router.use(authenticate, authorize("admin", "staff"));

async function canUpdateMeasurement(user, measurementId) {
  const rows = await query("SELECT * FROM measurements WHERE id = :id", { id: measurementId });
  const measurement = rows[0];
  if (!measurement) return null;
  if (user.role === "admin") return measurement;

  const orders = await query(
    "SELECT id FROM orders WHERE customer_id = :customerId AND assigned_staff_id = :staffId LIMIT 1",
    { customerId: measurement.customer_id, staffId: user.id }
  );

  return orders.length ? measurement : false;
}

router.patch("/:id", async (req, res, next) => {
  try {
    const measurement = await canUpdateMeasurement(req.user, req.params.id);
    if (measurement === null) throw httpError(404, "Measurement not found.");
    if (measurement === false) throw httpError(403, "You cannot update this measurement.");

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

    const updated = await query("SELECT * FROM measurements WHERE id = :id", { id: req.params.id });
    res.json({ measurement: updated[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
