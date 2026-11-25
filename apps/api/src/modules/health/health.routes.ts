import { Router } from "express";
import { db } from "../../db";

/**
 * - `/health/live`: o processo está de pé (não toca no banco).
 * - `/health/ready`: pronto para tráfego (banco responde). 503 se não.
 * - `/health`: legado, usado pelo health check do Render; equivale a ready.
 */
export const healthRoutes = Router();

healthRoutes.get("/live", (_req, res) => {
  res.json({ status: "ok", uptime: Math.round(process.uptime()) });
});

async function ready(_req: unknown, res: import("express").Response) {
  try {
    await db.query("SELECT 1");
    res.json({ status: "ok", uptime: Math.round(process.uptime()), checks: { database: "ok" } });
  } catch {
    res.status(503).json({ status: "error", checks: { database: "error" } });
  }
}

healthRoutes.get("/ready", ready);
healthRoutes.get("/", ready);
