-- Andamo — painel administrativo da plataforma e central de suporte. Migração aditiva.

-- Contas suspensas pela administração não autenticam (dados preservados).
ALTER TABLE users ADD COLUMN suspended_at timestamptz;

-- ---------------------------------------------------------------- chamados de suporte
CREATE TABLE support_tickets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid         REFERENCES users(id) ON DELETE SET NULL,
  workspace_id  uuid         REFERENCES workspaces(id) ON DELETE SET NULL,
  type          varchar(12)  NOT NULL CHECK (type IN ('question', 'bug', 'suggestion', 'billing', 'other')),
  subject       varchar(140) NOT NULL CHECK (length(btrim(subject)) > 0),
  status        varchar(14)  NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')),
  priority      varchar(8)   NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now(),
  closed_at     timestamptz
);
CREATE INDEX support_tickets_user_idx ON support_tickets (user_id, updated_at DESC);
CREATE INDEX support_tickets_status_idx ON support_tickets (status, updated_at DESC);

CREATE TABLE support_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid          NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id   uuid          REFERENCES users(id) ON DELETE SET NULL,
  is_staff    boolean       NOT NULL DEFAULT false,
  body        varchar(5000) NOT NULL CHECK (length(btrim(body)) > 0),
  created_at  timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX support_messages_ticket_idx ON support_messages (ticket_id, created_at);

-- ---------------------------------------------------------------- avisos globais
CREATE TABLE announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       varchar(120)  NOT NULL CHECK (length(btrim(title)) > 0),
  body        varchar(1000) NOT NULL DEFAULT '',
  level       varchar(10)   NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'critical')),
  starts_at   timestamptz   NOT NULL DEFAULT now(),
  ends_at     timestamptz,
  created_by  uuid          REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX announcements_active_idx ON announcements (starts_at, ends_at);

-- Métricas de cadastro e atividade.
CREATE INDEX users_created_idx ON users (created_at);
CREATE INDEX users_last_login_idx ON users (last_login_at);
