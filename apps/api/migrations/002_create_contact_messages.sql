-- Mensagens do formulário de contato da landing page (Fase 3).
-- Migração apenas aditiva: cria uma tabela nova, não altera dados existentes.

CREATE TABLE contact_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       varchar(80)   NOT NULL,
  email      varchar(254)  NOT NULL,
  topic      varchar(20)   NOT NULL CHECK (topic IN ('duvida', 'comercial', 'suporte', 'privacidade', 'outro')),
  message    varchar(2000) NOT NULL CHECK (length(btrim(message)) > 0),
  status     varchar(10)   NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'respondido', 'arquivado')),
  created_at timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX contact_messages_created_at_idx ON contact_messages (created_at DESC);
