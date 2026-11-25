import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { writable } from "../../middlewares/workspace";
import { legacyTaskController as legacy, taskController as c } from "./task.controller";

/** v1 — montado em /v1/workspaces/:workspaceId/tarefas (após requireWorkspace). Permissões finas no service. */
export const taskRoutes = Router({ mergeParams: true });
taskRoutes.use(writable);

taskRoutes.get("/", c.list);
taskRoutes.post("/", c.create);
taskRoutes.post("/lote", c.bulk);
taskRoutes.get("/:id", c.get);
taskRoutes.patch("/:id", c.update);
taskRoutes.delete("/:id", c.remove);
taskRoutes.post("/:id/restaurar", c.restore);
taskRoutes.delete("/:id/permanente", c.destroy);
taskRoutes.post("/:id/arquivar", c.archive);
taskRoutes.post("/:id/duplicar", c.duplicate);
taskRoutes.get("/:id/atividades", c.activity);
taskRoutes.post("/:id/checklist", c.addChecklistItem);
taskRoutes.patch("/:id/checklist/:itemId", c.updateChecklistItem);
taskRoutes.delete("/:id/checklist/:itemId", c.removeChecklistItem);
taskRoutes.post("/:id/dependencias", c.addDependency);
taskRoutes.delete("/:id/dependencias/:dependsOnId", c.removeDependency);
taskRoutes.post("/:id/seguir", c.follow);

/** Legado — /tarefas (cliente anterior). */
export const legacyTaskRoutes = Router();
legacyTaskRoutes.use(authenticate);
legacyTaskRoutes.get("/", legacy.list);
legacyTaskRoutes.post("/", legacy.create);
legacyTaskRoutes.post("/importar", legacy.importMany);
legacyTaskRoutes.get("/:id", legacy.get);
legacyTaskRoutes.patch("/:id", legacy.update);
legacyTaskRoutes.delete("/:id", legacy.remove);
