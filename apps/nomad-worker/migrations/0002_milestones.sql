ALTER TABLE proposals ADD COLUMN decided_at TEXT;

CREATE TABLE files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','ready','failed')),
  outline TEXT NOT NULL DEFAULT '',
  extraction_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, sha256)
);
CREATE INDEX files_user_time ON files(user_id, created_at DESC);

CREATE TABLE file_chunks (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  chunk_index INTEGER NOT NULL,
  heading TEXT NOT NULL,
  text TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (file_id, chunk_index)
);
CREATE INDEX file_chunks_file ON file_chunks(file_id, chunk_index);
CREATE VIRTUAL TABLE file_chunks_fts USING fts5(chunk_id UNINDEXED, file_id UNINDEXED, user_id UNINDEXED, name, heading, text);

CREATE TABLE threads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  source_client_id TEXT REFERENCES clients(id),
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  capture_kind TEXT NOT NULL CHECK (capture_kind IN ('verbatim','model_summarized')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX threads_user_time ON threads(user_id, created_at DESC);

CREATE TABLE usage_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX usage_events_kind_time ON usage_events(kind, created_at DESC);

CREATE TABLE evaluation_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  client_label TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  expected_tool TEXT NOT NULL,
  observed_tool TEXT,
  expected_scope TEXT NOT NULL,
  passed INTEGER NOT NULL CHECK (passed IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX evaluation_runs_user_time ON evaluation_runs(user_id, created_at DESC);
