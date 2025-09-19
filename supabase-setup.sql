-- Create folders table
CREATE TABLE IF NOT EXISTS fm_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES fm_folders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create files table  
CREATE TABLE IF NOT EXISTS fm_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  size BIGINT NOT NULL,
  checksum TEXT NOT NULL,
  folder_id UUID REFERENCES fm_folders(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_fm_folders_user_id ON fm_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_fm_folders_parent_id ON fm_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_fm_folders_path ON fm_folders(path);
CREATE INDEX IF NOT EXISTS idx_fm_files_folder_id ON fm_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_fm_files_user_id ON fm_files(user_id);
CREATE INDEX IF NOT EXISTS idx_fm_files_checksum ON fm_files(checksum);
CREATE INDEX IF NOT EXISTS idx_fm_files_created_at ON fm_files(created_at DESC);

-- Enable Row Level Security
ALTER TABLE fm_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE fm_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for folders
CREATE POLICY "Users can view their own folders" ON fm_folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own folders" ON fm_folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders" ON fm_folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders" ON fm_folders
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for files
CREATE POLICY "Users can view their own files" ON fm_files
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own files" ON fm_files
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own files" ON fm_files
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own files" ON fm_files
  FOR DELETE USING (auth.uid() = user_id);

-- Function to automatically create root folder for new users
CREATE OR REPLACE FUNCTION create_user_root_folder()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO fm_folders (name, parent_id, user_id, path)
  VALUES ('Root', NULL, NEW.id, '/');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create root folder when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_root_folder();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for files updated_at
CREATE TRIGGER update_fm_files_updated_at 
  BEFORE UPDATE ON fm_files 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();