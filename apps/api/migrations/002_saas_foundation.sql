-- Andamo — fundação SaaS (multi-tenant, sessões, RBAC, colaboração, notificações, filas).
-- Migração NÃO destrutiva: só adiciona tabelas/colunas e faz backfill dos dados existentes.
-- Cada usuário existente ganha um workspace pessoal com o projeto "Minhas tarefas",
-- e suas tarefas atuais passam a pertencer a esse projeto (mesma ordem e status).

-- ---------------------------------------------------------------- usuários
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN email_verified_at timestamptz;
ALTER TABLE users ADD COLUMN avatar_url text;
ALTER TABLE users ADD COLUMN locale varchar(10) NOT NULL DEFAULT 'pt-BR';
ALTER TABLE users ADD COLUMN timezone varchar(64) NOT NULL DEFAULT 'America/Sao_Paulo';
ALTER TABLE users ADD COLUMN is_platform_admin boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN google_sub varchar(255) UNIQUE;
ALTER TABLE users ADD COLUMN totp_secret text;
ALTER TABLE users ADD COLUMN totp_enabled_at timestamptz;
ALTER TABLE users ADD COLUMN onboarded_at timestamptz;
ALTER TABLE users ADD COLUMN failed_login_count integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until timestamptz;
ALTER TABLE users ADD COLUMN last_login_at timestamptz;
ALTER TABLE users ADD COLUMN deleted_at timestamptz;

-- Contas existentes já usavam o produto: consideramos o onboarding feito.
UPDATE users SET onboarded_at = created_at WHERE onboarded_at IS NULL;

-- ---------------------------------------------------------------- sessões e tokens
-- Uma linha por dispositivo logado. O refresh token é guardado apenas como hash (SHA-256)
-- e rotacionado a cada uso; reutilizar um token antigo revoga a sessão (detecção de roubo).
CREATE TABLE sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash char(64)    NOT NULL UNIQUE,
  previous_token_hash char(64),
  user_agent         varchar(400),
  ip                 varchar(64),
  created_at         timestamptz NOT NULL DEFAULT now(),
  last_used_at       timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL,
  revoked_at         timestamptz
);
CREATE INDEX sessions_user_idx ON sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX sessions_previous_hash_idx ON sessions (previous_token_hash);

-- Tokens de uso único (verificação de e-mail, redefinição de senha, desafio 2FA).
CREATE TABLE auth_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose     varchar(20) NOT NULL CHECK (purpose IN ('verify_email', 'reset_password', 'mfa_challenge')),
  token_hash  char(64)    NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_tokens_user_purpose_idx ON auth_tokens (user_id, purpose);

-- ---------------------------------------------------------------- workspaces (tenants)
CREATE TABLE workspaces (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         varchar(80)  NOT NULL CHECK (length(btrim(name)) > 0),
  slug         varchar(64)  NOT NULL UNIQUE,
  logo_url     text,
  owner_id     uuid         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  plan         varchar(20)  NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'business')),
  is_personal  boolean      NOT NULL DEFAULT false,
  archived_at  timestamptz,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX workspaces_owner_idx ON workspaces (owner_id);

CREATE TABLE workspace_members (
  workspace_id    uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            varchar(20) NOT NULL DEFAULT 'member'
                  CHECK (role IN ('owner', 'admin', 'manager', 'member', 'guest', 'viewer')),
  job_title       varchar(80),
  department      varchar(80),
  capacity_hours  smallint CHECK (capacity_hours IS NULL OR capacity_hours BETWEEN 0 AND 168),
  joined_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX workspace_members_user_idx ON workspace_members (user_id);

CREATE TABLE workspace_invitations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email         varchar(254) NOT NULL,
  role          varchar(20)  NOT NULL CHECK (role IN ('admin', 'manager', 'member', 'guest', 'viewer')),
  token_hash    char(64)     NOT NULL UNIQUE,
  invited_by    uuid         REFERENCES users(id) ON DELETE SET NULL,
  expires_at    timestamptz  NOT NULL,
  accepted_at   timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX workspace_invitations_ws_idx ON workspace_invitations (workspace_id);
CREATE INDEX workspace_invitations_email_idx ON workspace_invitations (lower(email));

CREATE TABLE teams (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          varchar(60) NOT NULL CHECK (length(btrim(name)) > 0),
  description   varchar(280),
  color         varchar(9)  NOT NULL DEFAULT '#6D5DFC',
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

CREATE TABLE team_members (
  team_id  uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, user_id)
);
CREATE INDEX team_members_user_idx ON team_members (user_id);

-- ---------------------------------------------------------------- projetos
CREATE TABLE projects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  team_id       uuid         REFERENCES teams(id) ON DELETE SET NULL,
  name          varchar(80)  NOT NULL CHECK (length(btrim(name)) > 0),
  description   varchar(2000),
  goal          varchar(500),
  icon          varchar(32)  NOT NULL DEFAULT 'folder',
  color         varchar(9)   NOT NULL DEFAULT '#6D5DFC',
  status        varchar(20)  NOT NULL DEFAULT 'active'
                CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  priority      varchar(10)  NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta', 'urgente')),
  start_date    date,
  due_date      date,
  owner_id      uuid         REFERENCES users(id) ON DELETE SET NULL,
  created_by    uuid         REFERENCES users(id) ON DELETE SET NULL,
  is_default    boolean      NOT NULL DEFAULT false,
  is_template   boolean      NOT NULL DEFAULT false,
  archived_at   timestamptz,
  deleted_at    timestamptz,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now(),
  CHECK (due_date IS NULL OR start_date IS NULL OR due_date >= start_date)
);
CREATE INDEX projects_workspace_idx ON projects (workspace_id) WHERE deleted_at IS NULL;

CREATE TABLE labels (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          varchar(40) NOT NULL CHECK (length(btrim(name)) > 0),
  color         varchar(9)  NOT NULL DEFAULT '#6D5DFC',
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

-- ---------------------------------------------------------------- tarefas (extensão)
ALTER TABLE tasks ADD COLUMN workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN parent_id uuid REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN start_date date;
ALTER TABLE tasks ADD COLUMN due_time time;
ALTER TABLE tasks ADD COLUMN estimate_minutes integer CHECK (estimate_minutes IS NULL OR estimate_minutes >= 0);
ALTER TABLE tasks ADD COLUMN recurrence varchar(20) CHECK (recurrence IS NULL OR recurrence IN ('daily', 'weekly', 'monthly'));
ALTER TABLE tasks ADD COLUMN archived_at timestamptz;
ALTER TABLE tasks ADD COLUMN deleted_at timestamptz;
ALTER TABLE tasks ALTER COLUMN description TYPE varchar(20000);
-- `user_id` passa a significar "criado por": excluir a conta não apaga tarefas de workspaces compartilhados.
ALTER TABLE tasks ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE tasks DROP CONSTRAINT tasks_user_id_fkey;
ALTER TABLE tasks ADD CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tasks DROP CONSTRAINT tasks_priority_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check CHECK (priority IN ('baixa', 'media', 'alta', 'urgente'));

-- Backfill: workspace pessoal + projeto padrão para cada usuário existente.
INSERT INTO workspaces (name, slug, owner_id, is_personal, created_at)
SELECT 'Espaço de ' || split_part(btrim(name), ' ', 1), 'u-' || replace(id::text, '-', ''), id, true, created_at
FROM users;

INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
SELECT id, owner_id, 'owner', created_at FROM workspaces;

INSERT INTO projects (workspace_id, name, icon, owner_id, created_by, is_default, created_at)
SELECT id, 'Minhas tarefas', 'check-square', owner_id, owner_id, true, created_at FROM workspaces;

UPDATE tasks t
SET workspace_id = p.workspace_id, project_id = p.id
FROM projects p
JOIN workspaces w ON w.id = p.workspace_id
WHERE p.is_default AND w.is_personal AND w.owner_id = t.user_id;

ALTER TABLE tasks ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE tasks ALTER COLUMN project_id SET NOT NULL;

CREATE INDEX tasks_project_status_position_idx ON tasks (project_id, status, position) WHERE deleted_at IS NULL;
CREATE INDEX tasks_workspace_due_idx ON tasks (workspace_id, due_date) WHERE deleted_at IS NULL;
CREATE INDEX tasks_parent_idx ON tasks (parent_id);

CREATE TABLE task_assignees (
  task_id  uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);
CREATE INDEX task_assignees_user_idx ON task_assignees (user_id);

CREATE TABLE task_followers (
  task_id  uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, user_id)
);
CREATE INDEX task_followers_user_idx ON task_followers (user_id);

CREATE TABLE task_labels (
  task_id   uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id  uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

CREATE TABLE task_dependencies (
  task_id        uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id  uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on_id),
  CHECK (task_id <> depends_on_id)
);

CREATE TABLE checklist_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid         NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content     varchar(300) NOT NULL CHECK (length(btrim(content)) > 0),
  done        boolean      NOT NULL DEFAULT false,
  position    integer      NOT NULL DEFAULT 0,
  created_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX checklist_items_task_idx ON checklist_items (task_id, position);

-- ---------------------------------------------------------------- colaboração
CREATE TABLE comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid          NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id   uuid          REFERENCES users(id) ON DELETE SET NULL,
  parent_id   uuid          REFERENCES comments(id) ON DELETE CASCADE,
  body        varchar(5000) NOT NULL CHECK (length(btrim(body)) > 0),
  edited_at   timestamptz,
  deleted_at  timestamptz,
  created_at  timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX comments_task_idx ON comments (task_id, created_at);

CREATE TABLE comment_reactions (
  comment_id  uuid        NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji       varchar(16) NOT NULL,
  PRIMARY KEY (comment_id, user_id, emoji)
);

-- Feed/auditoria por workspace (quem fez o quê, quando).
CREATE TABLE activity_log (
  id            bigserial PRIMARY KEY,
  workspace_id  uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id      uuid        REFERENCES users(id) ON DELETE SET NULL,
  entity_type   varchar(20) NOT NULL,
  entity_id     uuid        NOT NULL,
  project_id    uuid,
  action        varchar(40) NOT NULL,
  data          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_log_ws_idx ON activity_log (workspace_id, created_at DESC);
CREATE INDEX activity_log_entity_idx ON activity_log (entity_type, entity_id, created_at DESC);

-- ---------------------------------------------------------------- notificações
CREATE TABLE notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id  uuid         REFERENCES workspaces(id) ON DELETE CASCADE,
  type          varchar(40)  NOT NULL,
  category      varchar(20)  NOT NULL DEFAULT 'tasks',
  title         varchar(200) NOT NULL,
  body          varchar(500),
  link          varchar(300),
  entity_type   varchar(20),
  entity_id     uuid,
  actor_id      uuid         REFERENCES users(id) ON DELETE SET NULL,
  dedupe_key    varchar(200),
  read_at       timestamptz,
  created_at    timestamptz  NOT NULL DEFAULT now()
);
-- Idempotência: o mesmo evento não gera duas notificações para o mesmo usuário.
CREATE UNIQUE INDEX notifications_dedupe_idx ON notifications (user_id, dedupe_key);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON notifications (user_id) WHERE read_at IS NULL;

CREATE TABLE notification_preferences (
  user_id           uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  in_app            boolean     NOT NULL DEFAULT true,
  push              boolean     NOT NULL DEFAULT true,
  email             boolean     NOT NULL DEFAULT true,
  sound             boolean     NOT NULL DEFAULT false,
  muted_categories  text[]      NOT NULL DEFAULT '{}',
  muted_projects    uuid[]      NOT NULL DEFAULT '{}',
  quiet_start       time,
  quiet_end         time,
  dnd_until         timestamptz,
  email_digest      varchar(10) NOT NULL DEFAULT 'instant' CHECK (email_digest IN ('instant', 'daily', 'weekly', 'off')),
  reminder_offsets  integer[]   NOT NULL DEFAULT '{1440,60,0}',
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint      text         NOT NULL UNIQUE,
  p256dh        text         NOT NULL,
  auth          text         NOT NULL,
  user_agent    varchar(400),
  created_at    timestamptz  NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  failure_count integer      NOT NULL DEFAULT 0
);
CREATE INDEX push_subscriptions_user_idx ON push_subscriptions (user_id);

-- Registro de cada tentativa de entrega (push/e-mail) para monitorar falhas.
CREATE TABLE delivery_logs (
  id               bigserial PRIMARY KEY,
  notification_id  uuid        REFERENCES notifications(id) ON DELETE SET NULL,
  user_id          uuid        REFERENCES users(id) ON DELETE CASCADE,
  channel          varchar(10) NOT NULL CHECK (channel IN ('push', 'email')),
  status           varchar(10) NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  detail           varchar(500),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX delivery_logs_created_idx ON delivery_logs (created_at DESC);

-- ---------------------------------------------------------------- fila de jobs (PostgreSQL)
-- Fila durável sem Redis: workers buscam com FOR UPDATE SKIP LOCKED, com retry exponencial.
-- `dedupe_key` garante idempotência (ex.: um único lembrete por tarefa/usuário/antecedência).
CREATE TABLE jobs (
  id            bigserial PRIMARY KEY,
  type          varchar(40)  NOT NULL,
  payload       jsonb        NOT NULL DEFAULT '{}'::jsonb,
  run_at        timestamptz  NOT NULL DEFAULT now(),
  attempts      integer      NOT NULL DEFAULT 0,
  max_attempts  integer      NOT NULL DEFAULT 5,
  status        varchar(10)  NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'running', 'done', 'failed', 'cancelled')),
  locked_at     timestamptz,
  last_error    varchar(1000),
  dedupe_key    varchar(200) UNIQUE,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  finished_at   timestamptz
);
CREATE INDEX jobs_pending_idx ON jobs (run_at) WHERE status = 'pending';

-- Auditoria de ações sensíveis (segurança, permissões, administração).
CREATE TABLE audit_log (
  id            bigserial PRIMARY KEY,
  actor_id      uuid        REFERENCES users(id) ON DELETE SET NULL,
  workspace_id  uuid        REFERENCES workspaces(id) ON DELETE SET NULL,
  action        varchar(60) NOT NULL,
  target        varchar(120),
  ip            varchar(64),
  data          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);

-- Mensagens do formulário de contato da landing page (atendidas pelo painel administrativo).
CREATE TABLE contact_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(80)   NOT NULL,
  email       varchar(254)  NOT NULL,
  subject     varchar(120)  NOT NULL,
  message     varchar(4000) NOT NULL,
  ip          varchar(64),
  handled_at  timestamptz,
  created_at  timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX contact_messages_created_idx ON contact_messages (created_at DESC);
