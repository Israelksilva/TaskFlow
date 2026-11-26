import { beforeEach, describe, expect, it } from "vitest";
import type { ReportData } from "@andamo/shared";
import { addDays, toISODate } from "@andamo/shared";
import { db } from "../src/db";
import { api, auth, createProject, createTaskV1, createTeamWorkspace, createUser, resetDatabase } from "./helpers";

beforeEach(resetDatabase);

const today = toISODate();

async function setup() {
  const owner = await createUser();
  // "Hoje" do teste e do usuário no mesmo fuso (o CI roda em UTC).
  await db.query(`UPDATE users SET timezone = $2 WHERE id = $1`, [owner.user.id, Intl.DateTimeFormat().resolvedOptions().timeZone]);
  const ws = await createTeamWorkspace(owner.token);
  const project = await createProject(owner.token, ws.id, { name: "Site" });
  const base = `/v1/workspaces/${ws.id}`;
  const report = async (q: string) => (await api().get(`${base}/relatorios?${q}`).set(auth(owner.token)).expect(200)).body as ReportData;
  return { owner, ws, project, base, report };
}

describe("relatórios", () => {
  it("calcula totais reais, taxa no prazo e compara com o período anterior", async () => {
    const { owner, ws, project, base, report } = await setup();
    const a = await createTaskV1(owner.token, ws.id, { title: "A", projectId: project.id, dueDate: addDays(today, 3), assigneeIds: [owner.user.id] });
    const b = await createTaskV1(owner.token, ws.id, { title: "B", projectId: project.id, dueDate: addDays(today, -2), estimateMinutes: 90, assigneeIds: [owner.user.id] });
    const old = await createTaskV1(owner.token, ws.id, { title: "Antiga", projectId: project.id });
    await api().patch(`${base}/tarefas/${a.id}`).set(auth(owner.token)).send({ status: "done" }).expect(200);
    // "Antiga" foi criada e concluída no período anterior.
    await db.query(`UPDATE tasks SET created_at = now() - interval '10 days', completed_at = now() - interval '9 days', status = 'done' WHERE id = $1`, [old.id]);
    await db.query(
      `INSERT INTO time_entries (workspace_id, task_id, user_id, started_at, ended_at, duration_seconds, source)
       VALUES ($1, $2, $3, now() - interval '2 hours', now() - interval '1 hour', 3600, 'manual')`,
      [ws.id, b.id, owner.user.id],
    );

    const r = await report(`from=${addDays(today, -6)}&to=${today}`);
    expect(r.totals).toMatchObject({ created: 2, completed: 1, overdue: 1, onTimeRate: 100, trackedSeconds: 3600 });
    expect(r.totals.completionRate).toBe(50);
    expect(r.previous).toEqual({ from: addDays(today, -13), to: addDays(today, -7) });
    expect(r.previousTotals).toMatchObject({ created: 1, completed: 1 });
    expect(r.granularity).toBe("day");
    expect(r.series).toHaveLength(7);
    expect(r.series.at(-1)).toMatchObject({ bucket: today, created: 2, completed: 1, trackedSeconds: 3600 });

    const site = r.byProject.find((p) => p.projectId === project.id)!;
    expect(site).toMatchObject({ open: 1, completed: 1, overdue: 1, trackedSeconds: 3600 });
    const me = r.byPerson.find((p) => p.user.id === owner.user.id)!;
    expect(me).toMatchObject({ open: 1, completed: 1, overdue: 1, openEstimateMinutes: 90, trackedSeconds: 3600 });
  });

  it("agrupa por semana em períodos longos, filtra por projeto e valida o período", async () => {
    const { owner, ws, project, base, report } = await setup();
    const other = await createProject(owner.token, ws.id, { name: "Outro" });
    await createTaskV1(owner.token, ws.id, { title: "X", projectId: other.id });
    await createTaskV1(owner.token, ws.id, { title: "Y", projectId: project.id });
    const r = await report(`from=${addDays(today, -60)}&to=${today}&projectId=${project.id}`);
    expect(r.granularity).toBe("week");
    expect(r.totals.created).toBe(1);
    expect(r.byProject.map((p) => p.projectId)).toEqual([project.id]);

    await api().get(`${base}/relatorios?from=${today}&to=${addDays(today, -1)}`).set(auth(owner.token)).expect(422);
    await api().get(`${base}/relatorios?from=${addDays(today, -400)}&to=${today}`).set(auth(owner.token)).expect(422);
  });

  it("não expõe dados de outro workspace", async () => {
    const { ws } = await setup();
    const outsider = await createUser();
    await api().get(`/v1/workspaces/${ws.id}/relatorios?from=${today}&to=${today}`).set(auth(outsider.token)).expect(404);
  });
});
