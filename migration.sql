-- Supabase migration for shortlink
-- Run this in your Supabase SQL Editor (https://app.supabase.com)

CREATE TABLE shortlinks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT DEFAULT '',
  images JSONB DEFAULT '[]'::jsonb,
  description TEXT DEFAULT '',
  namespace TEXT DEFAULT 'default',
  created TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE shortlinks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read" ON shortlinks FOR SELECT USING (true);
CREATE POLICY "public_insert" ON shortlinks FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update" ON shortlinks FOR UPDATE USING (true);
CREATE POLICY "public_delete" ON shortlinks FOR DELETE USING (true);
