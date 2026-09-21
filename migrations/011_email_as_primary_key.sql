-- Migration 011: Use email as primary key instead of ID
-- This prevents issues when Cloudflare Access user IDs change

-- Step 1: Create new users table with email as primary key
CREATE TABLE users_new (
  email TEXT PRIMARY KEY,
  name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Step 2: Copy existing users (using email as the key)
INSERT INTO users_new (email, name, created_at, last_login)
SELECT email, name, created_at, last_login FROM users;

-- Step 3: Create new user_favorites table with email reference
CREATE TABLE user_favorites_new (
  user_email TEXT NOT NULL,
  photo_id TEXT NOT NULL,
  event_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_email, photo_id),
  FOREIGN KEY (user_email) REFERENCES users_new(email) ON DELETE CASCADE,
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Step 4: Copy favorites using email
INSERT INTO user_favorites_new (user_email, photo_id, event_id, created_at)
SELECT u.email, uf.photo_id, uf.event_id, uf.created_at
FROM user_favorites uf
JOIN users u ON uf.user_id = u.id;

-- Step 5: Create new event_collaborators table with email reference
CREATE TABLE event_collaborators_new (
  event_id INTEGER NOT NULL,
  user_email TEXT NOT NULL,
  invited_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (event_id, user_email),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_email) REFERENCES users_new(email) ON DELETE CASCADE
);

-- Step 6: Copy collaborators using email
INSERT INTO event_collaborators_new (event_id, user_email, invited_at)
SELECT ec.event_id, u.email, ec.invited_at
FROM event_collaborators ec
JOIN users u ON ec.user_id = u.id;

-- Steps 7-8 skipped:
-- collaboration_history already uses user_email and target_user_email
-- since migration 010.

-- Step 9: Drop old tables
DROP TABLE event_collaborators;
DROP TABLE user_favorites;
DROP INDEX IF EXISTS idx_user_favorites_user;
DROP INDEX IF EXISTS idx_user_favorites_photo;
DROP INDEX IF EXISTS idx_users_email;
DROP TABLE users;

-- Step 10: Rename new tables
ALTER TABLE users_new RENAME TO users;
ALTER TABLE user_favorites_new RENAME TO user_favorites;
ALTER TABLE event_collaborators_new RENAME TO event_collaborators;

-- Step 11: Recreate indexes with new structure
CREATE INDEX idx_user_favorites_user ON user_favorites(user_email, created_at DESC);
CREATE INDEX idx_user_favorites_photo ON user_favorites(photo_id);
CREATE INDEX idx_event_collaborators_email ON event_collaborators(user_email);
CREATE INDEX IF NOT EXISTS idx_collaboration_history_event ON collaboration_history(event_id, created_at DESC);

-- Note: photos.uploaded_by should also reference email now, but if it was never deployed,
-- we don't need to migrate it. The migration 009 will need to be updated.
