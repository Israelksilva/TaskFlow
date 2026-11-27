-- Andamo — assinaturas (Mercado Pago, modo teste) e arquivos (Cloudflare R2 privado). Migração aditiva.

-- ---------------------------------------------------------------- assinaturas
CREATE TABLE subscriptions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider             varchar(20)  NOT NULL DEFAULT 'mercadopago' CHECK (provider IN ('mercadopago')),
  provider_id          varchar(80)  UNIQUE,
  plan                 varchar(20)  NOT NULL CHECK (plan IN ('pro', 'business')),
  -- pending: aguardando o cliente autorizar no Mercado Pago; authorized: ativa; paused; cancelled.
  status               varchar(12)  NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'paused', 'cancelled')),
  amount_cents         integer      NOT NULL CHECK (amount_cents > 0),
  payer_email          varchar(254) NOT NULL,
  test_mode            boolean      NOT NULL DEFAULT true,
  next_payment_at      timestamptz,
  cancelled_at         timestamptz,
  -- Plano pago vale até aqui depois do cancelamento (fim do ciclo já pago).
  ends_at              timestamptz,
  -- Quando o rebaixamento ao Free já foi aplicado (não reaplica sobre um plano atribuído depois).
  expired_at           timestamptz,
  created_by           uuid         REFERENCES users(id) ON DELETE SET NULL,
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_workspace_idx ON subscriptions (workspace_id, created_at DESC);
-- No máximo uma assinatura em andamento por workspace.
CREATE UNIQUE INDEX subscriptions_one_active_idx ON subscriptions (workspace_id) WHERE status IN ('pending', 'authorized', 'paused');

-- Notificações recebidas do provedor (auditoria e idempotência).
CREATE TABLE payment_events (
  id            bigserial PRIMARY KEY,
  provider      varchar(20)  NOT NULL,
  request_id    varchar(120) NOT NULL,
  type          varchar(60)  NOT NULL,
  resource_id   varchar(80),
  status        varchar(12)  NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  detail        text,
  received_at   timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (provider, request_id)
);

-- ---------------------------------------------------------------- arquivos (R2)
CREATE TABLE attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid          NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id    uuid          NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- NULL = documento do projeto; preenchido = anexo da tarefa.
  task_id       uuid          REFERENCES tasks(id) ON DELETE CASCADE,
  uploaded_by   uuid          REFERENCES users(id) ON DELETE SET NULL,
  storage_key   varchar(300)  NOT NULL UNIQUE,
  file_name     varchar(200)  NOT NULL CHECK (length(btrim(file_name)) > 0),
  content_type  varchar(150)  NOT NULL,
  size_bytes    bigint        NOT NULL CHECK (size_bytes > 0),
  status        varchar(10)   NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready')),
  created_at    timestamptz   NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX attachments_task_idx ON attachments (task_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX attachments_project_idx ON attachments (project_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX attachments_workspace_idx ON attachments (workspace_id) WHERE deleted_at IS NULL;
