-- Andamo — automações (gatilho → condições → ações) e histórico de execuções. Migração aditiva.

CREATE TABLE automations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  -- NULL = vale para todos os projetos do workspace.
  project_id    uuid         REFERENCES projects(id) ON DELETE CASCADE,
  name          varchar(80)  NOT NULL CHECK (length(btrim(name)) > 0),
  enabled       boolean      NOT NULL DEFAULT true,
  trigger       varchar(30)  NOT NULL CHECK (trigger IN (
                  'task.created', 'task.completed', 'task.status_changed', 'task.moved',
                  'task.overdue', 'subtasks.completed', 'project.completed')),
  conditions    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  actions       jsonb        NOT NULL DEFAULT '[]'::jsonb,
  created_by    uuid         REFERENCES users(id) ON DELETE SET NULL,
  run_count     integer      NOT NULL DEFAULT 0,
  last_run_at   timestamptz,
  last_error    varchar(500),
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX automations_ws_trigger_idx ON automations (workspace_id, trigger) WHERE enabled;

CREATE TABLE automation_runs (
  id             bigserial PRIMARY KEY,
  automation_id  uuid        NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  workspace_id   uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id        uuid        REFERENCES tasks(id) ON DELETE SET NULL,
  project_id     uuid,
  status         varchar(10) NOT NULL CHECK (status IN ('success', 'skipped', 'failed')),
  detail         varchar(500),
  depth          smallint    NOT NULL DEFAULT 0,
  -- Idempotência: o mesmo evento não executa a mesma automação duas vezes.
  event_key      varchar(200) NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (automation_id, event_key)
);
CREATE INDEX automation_runs_auto_idx ON automation_runs (automation_id, created_at DESC);
CREATE INDEX automation_runs_ws_idx ON automation_runs (workspace_id, created_at DESC);
