import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { getUserId } from "../../shared/http";
import { timeService } from "./time.service";

/** Cronômetro do usuário (independe do workspace aberto: só existe um rodando por pessoa). */
export const timerRoutes = Router();
timerRoutes.use(authenticate);

timerRoutes.get("/ativo", async (req, res) => {
  res.json({ entry: await timeService.running(getUserId(req)) });
});

timerRoutes.post("/parar", async (req, res) => {
  res.json({ entry: await timeService.stop(getUserId(req)) });
});
