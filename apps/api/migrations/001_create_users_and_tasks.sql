-- Andamo — esquema inicial (PostgreSQL 13+ / Neon)

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          varchar(80)  NOT NULL,
  email         varchar(254) NOT NULL UNIQUE,
  password_hash text         NOT NULL,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        varchar(120) NOT NULL CHECK (length(btrim(title)) > 0),
  description  varchar(2000),
  priority     varchar(10)  NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta')),
  status       varchar(10)  NOT NULL DEFAULT 'todo'  CHECK (status IN ('todo', 'doing', 'done')),
  position     integer      NOT NULL DEFAULT 0 CHECK (position >= 0),
  due_date     date,
  completed_at timestamptz,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now()
);

-- Leitura do quadro: tarefas do usuário por coluna, na ordem.
CREATE INDEX tasks_user_status_position_idx ON tasks (user_id, status, position);
