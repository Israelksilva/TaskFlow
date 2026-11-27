-- Fase 4 — autenticação completa. Somente acréscimos: nenhum dado existente é removido ou alterado.

-- Usuários: verificação de e-mail, 2FA, Google e preferências.
-- Contas criadas só com o Google não têm senha.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN email_verified_at   timestamptz;
ALTER TABLE users ADD COLUMN password_changed_at timestamptz;
-- Segredo do 2FA cifrado com AES-256-GCM.
ALTER TABLE users ADD COLUMN totp_secret         text;
ALTER TABLE users ADD COLUMN totp_enabled_at     timestamptz;
ALTER TABLE users ADD COLUMN totp_last_counter   bigint;
ALTER TABLE users ADD COLUMN google_sub          varchar(255) UNIQUE;
ALTER TABLE users ADD COLUMN locale              varchar(10)  NOT NULL DEFAULT 'pt-BR';
ALTER TABLE users ADD COLUMN timezone            varchar(64)  NOT NULL DEFAULT 'America/Sao_Paulo';

-- Sessões: uma linha por dispositivo. O refresh token só existe em hash e é trocado a cada uso;
-- o hash anterior fica guardado para detectar reuso (sinal de roubo) e derrubar a sessão.
CREATE TABLE sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash         char(64)     NOT NULL UNIQUE,
  previous_hash      char(64),
  rotated_at         timestamptz,
  remember           boolean      NOT NULL DEFAULT false,
  user_agent         varchar(300),
  ip                 varchar(64),
  created_at         timestamptz  NOT NULL DEFAULT now(),
  last_used_at       timestamptz  NOT NULL DEFAULT now(),
  expires_at         timestamptz  NOT NULL,
  revoked_at         timestamptz,
  revoked_reason     varchar(30)
);
CREATE INDEX sessions_user_idx ON sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX sessions_previous_hash_idx ON sessions (previous_hash);

-- Tokens de uso único (verificação de e-mail, redefinição de senha, desafio de 2FA, OAuth).
CREATE TABLE auth_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid         REFERENCES users(id) ON DELETE CASCADE,
  purpose     varchar(30)  NOT NULL CHECK (purpose IN ('verify_email', 'reset_password', 'mfa_challenge', 'oauth_state', 'oauth_exchange')),
  token_hash  char(64)     NOT NULL UNIQUE,
  payload     jsonb,
  expires_at  timestamptz  NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX auth_tokens_user_purpose_idx ON auth_tokens (user_id, purpose);

-- Códigos de recuperação do 2FA (somente hash).
CREATE TABLE recovery_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  char(64)    NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recovery_codes_user_idx ON recovery_codes (user_id);

-- Bloqueio progressivo por e-mail (existente ou não, para não revelar contas).
CREATE TABLE login_throttle (
  email          varchar(254) PRIMARY KEY,
  failed_count   integer      NOT NULL DEFAULT 0,
  locked_until   timestamptz,
  last_failed_at timestamptz  NOT NULL DEFAULT now()
);
