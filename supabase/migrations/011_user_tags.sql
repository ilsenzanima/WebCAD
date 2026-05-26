CREATE TABLE IF NOT EXISTS user_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, section, name)
);

ALTER TABLE user_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gli utenti gestiscono i propri tag"
  ON user_tags FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
