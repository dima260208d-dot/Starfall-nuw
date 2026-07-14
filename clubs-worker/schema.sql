-- Starfall clubs — Cloudflare D1 schema.
-- The club document (full JSON, same shape the game uses) is the source of truth;
-- indexed columns exist for fast list/search. Membership is one club per player.

CREATE TABLE IF NOT EXISTS clubs (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  name_lower     TEXT NOT NULL,
  description    TEXT DEFAULT '',
  type           TEXT DEFAULT 'open',
  member_count   INTEGER DEFAULT 0,
  total_trophies INTEGER DEFAULT 0,
  created_at     INTEGER,
  updated_at     INTEGER,
  data           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clubs_name_lower ON clubs(name_lower);
CREATE INDEX IF NOT EXISTS idx_clubs_updated    ON clubs(updated_at);
CREATE INDEX IF NOT EXISTS idx_clubs_members    ON clubs(member_count);
CREATE INDEX IF NOT EXISTS idx_clubs_trophies   ON clubs(total_trophies);

-- Which club each player belongs to (enforces one club per player server-side).
CREATE TABLE IF NOT EXISTS memberships (
  username   TEXT PRIMARY KEY,
  player_id  TEXT,
  club_id    TEXT,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_memberships_club ON memberships(club_id);

-- Per-IP rate limiting (best-effort anti-abuse).
CREATE TABLE IF NOT EXISTS rate_limits (
  k          TEXT PRIMARY KEY,
  count      INTEGER DEFAULT 0,
  window_end INTEGER
);
