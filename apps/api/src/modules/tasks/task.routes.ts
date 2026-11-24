import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { taskController } from "./task.controller";

export const taskRoutes = Router();

// Todas as operações exigem login e se limitam às tarefas do usuário autenticado.
taskRoutes.use(authenticate);

taskRoutes.get("/", taskController.list);
taskRoutes.post("/", taskController.create);
taskRoutes.post("/importar", taskController.importMany);
taskRoutes.get("/:id", taskController.get);
taskRoutes.patch("/:id", taskController.update);
taskRoutes.delete("/:id", taskController.remove);
