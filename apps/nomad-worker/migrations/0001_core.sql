CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  label TEXT NOT NULL,
  oauth_client_id TEXT NOT NULL,
  trust_mode TEXT NOT NULL DEFAULT 'ask' CHECK (trust_mode IN ('ask', 'auto')),
  connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, oauth_client_id)
);

CREATE TABLE fields (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  project TEXT NOT NULL DEFAULT 'personal',
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  sensitivity TEXT NOT NULL DEFAULT 'normal' CHECK (sensitivity IN ('normal', 'sensitive', 'sealed')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source_client_id TEXT REFERENCES clients(id),
  UNIQUE (user_id, project, key)
);
CREATE INDEX fields_user_project ON fields(user_id, project, updated_at DESC);

CREATE TABLE field_versions (
  id TEXT PRIMARY KEY,
  field_id TEXT NOT NULL REFERENCES fields(id),
  value TEXT NOT NULL,
  actor TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('user', 'client')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX field_versions_field ON field_versions(field_id, created_at DESC);

CREATE TABLE proposals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  field_id TEXT NOT NULL REFERENCES fields(id),
  proposed_value TEXT NOT NULL,
  reason TEXT NOT NULL,
  base_version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'rejected', 'superseded')),
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (client_id, idempotency_key)
);
CREATE INDEX proposals_user_status ON proposals(user_id, status, created_at DESC);

CREATE TABLE audit (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  client_id TEXT REFERENCES clients(id),
  action TEXT NOT NULL,
  target_ids TEXT NOT NULL,
  value_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX audit_user_time ON audit(user_id, created_at DESC);

CREATE VIRTUAL TABLE fields_fts USING fts5(field_id UNINDEXED, user_id UNINDEXED, project UNINDEXED, key, value);
CREATE TRIGGER fields_fts_insert AFTER INSERT ON fields WHEN NEW.sensitivity <> 'sealed' BEGIN
  INSERT INTO fields_fts(field_id, user_id, project, key, value)
  VALUES (NEW.id, NEW.user_id, NEW.project, NEW.key, NEW.value);
END;
CREATE TRIGGER fields_fts_update AFTER UPDATE ON fields BEGIN
  DELETE FROM fields_fts WHERE field_id = OLD.id;
  INSERT INTO fields_fts(field_id, user_id, project, key, value)
  SELECT NEW.id, NEW.user_id, NEW.project, NEW.key, NEW.value
  WHERE NEW.sensitivity <> 'sealed';
END;
CREATE TRIGGER fields_fts_delete AFTER DELETE ON fields BEGIN
  DELETE FROM fields_fts WHERE field_id = OLD.id;
END;
