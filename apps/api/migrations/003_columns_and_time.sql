-- Andamo — colunas personalizáveis do Kanban e controle de tempo.
-- Migração NÃO destrutiva: cada projeto existente ganha as 3 colunas atuais e cada tarefa
-- passa a apontar para a coluna da sua categoria (mesma ordem). `tasks.status` continua existindo
-- e é sempre a categoria da coluna (dashboard, lembretes e notificações seguem funcionando).

CREATE TABLE project_columns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        varchar(40) NOT NULL CHECK (length(btrim(name)) > 0),
  category    varchar(10) NOT NULL CHECK (category IN ('todo', 'doing', 'done')),
  position    integer     NOT NULL DEFAULT 0 CHECK (position >= 0),
  wip_limit   integer     CHECK (wip_limit IS NULL OR wip_limit BETWEEN 1 AND 999),
  color       varchar(9),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_columns_project_idx ON project_columns (project_id, position);

INSERT INTO project_columns (project_id, name, category, position)
SELECT p.id, v.name, v.category, v.position
FROM projects p
CROSS JOIN (VALUES ('A Fazer', 'todo', 0), ('Em Progresso', 'doing', 1), ('Concluído', 'done', 2)) AS v(name, category, position);

ALTER TABLE tasks ADD COLUMN column_id uuid REFERENCES project_columns(id) ON DELETE SET NULL;

UPDATE tasks t SET column_id = c.id
FROM project_columns c
WHERE c.project_id = t.project_id AND c.category = t.status;

CREATE INDEX tasks_column_position_idx ON tasks (column_id, position) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------- controle de tempo
CREATE TABLE time_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id           uuid         NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id           uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at        timestamptz  NOT NULL,
  ended_at          timestamptz,
  duration_seconds  integer      CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  note              varchar(500),
  source            varchar(10)  NOT NULL DEFAULT 'timer' CHECK (source IN ('timer', 'manual')),
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
-- No máximo UM cronômetro rodando por pessoa (evita sessões simultâneas indevidas).
CREATE UNIQUE INDEX time_entries_one_running_idx ON time_entries (user_id) WHERE ended_at IS NULL;
CREATE INDEX time_entries_ws_started_idx ON time_entries (workspace_id, started_at DESC);
CREATE INDEX time_entries_task_idx ON time_entries (task_id);
