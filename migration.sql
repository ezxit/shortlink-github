-- Supabase migration for shortlink
-- Run this in your Supabase SQL Editor (https://app.supabase.com)

-- ============================================================
-- Supabase migration for shortlink
-- Run in Supabase SQL Editor (https://app.supabase.com)
-- ============================================================

CREATE TABLE shortlinks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT DEFAULT '',
  images JSONB DEFAULT '[]'::jsonb,
  files JSONB DEFAULT '[]'::jsonb,   -- [{name, size, url, type, key}]
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

-- ============================================================
-- Storage bucket for file uploads
-- ============================================================
-- Run this separately in Storage > Create a new bucket named "files"
-- Make it public so files can be accessed via public URL.
-- Then add this policy to allow anonymous uploads:
/*
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', true);

-- Allow anonymous uploads to files bucket
CREATE POLICY "public_upload_files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'files');

-- Allow anonymous reads from files bucket
CREATE POLICY "public_read_files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'files');

-- Allow anonymous deletes from files bucket
CREATE POLICY "public_delete_files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'files');
*/
