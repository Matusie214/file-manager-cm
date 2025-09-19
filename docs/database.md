# Dokumentacja Bazy Danych

## Przegląd Architektury

File Manager wykorzystuje **PostgreSQL** przez Supabase z następującymi wzorcami:
- **Row Level Security (RLS)** dla user isolation
- **Materialized Path Pattern** dla hierarchii folderów
- **Cascading Deletes** dla data integrity
- **Automated Triggers** dla business logic

---

## Schema Overview

```sql
Database: PostgreSQL 15+ (Supabase)
Tables: fm_folders, fm_files
Auth: Supabase Auth (auth.users)
Storage: Supabase Storage (storage.objects)
```

---

## Table Structures

### **fm_folders**
Hierarchiczna struktura folderów z materialized paths.

```sql
CREATE TABLE fm_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES fm_folders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **Kolumny:**
- `id` - Primary key (UUID v4)
- `name` - Nazwa folderu (max 255 chars)
- `parent_id` - Foreign key do parent folder (NULL dla root)
- `user_id` - Foreign key do auth.users (owner)
- `path` - Materialized path dla hierarchii
- `created_at` - Timestamp utworzenia

#### **Przykładowe dane:**
```sql
-- Root folder
id: '123...', name: 'Root', parent_id: NULL, path: '/'

-- Level 1
id: '456...', name: 'Documents', parent_id: '123...', path: '/Documents/'

-- Level 2  
id: '789...', name: 'Reports', parent_id: '456...', path: '/Documents/Reports/'
```

#### **Constraints:**
- `name` nie może być pusty
- `user_id` musi istnieć w auth.users
- `parent_id` musi istnieć w fm_folders (jeśli nie NULL)
- Unique constraint na (user_id, parent_id, name)

---

### **fm_files**
Metadata plików z referencjami do storage.

```sql
CREATE TABLE fm_files (
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
```

#### **Kolumny:**
- `id` - Primary key (UUID v4)
- `name` - Oryginalna nazwa pliku
- `size` - Rozmiar w bajtach
- `checksum` - SHA256 hash dla deduplication
- `folder_id` - Foreign key do fm_folders
- `user_id` - Foreign key do auth.users (owner)
- `storage_path` - Ścieżka w Supabase Storage
- `mime_type` - MIME type (application/pdf)
- `created_at` - Timestamp uploadu
- `updated_at` - Timestamp ostatniej modyfikacji

#### **Przykładowe dane:**
```sql
id: 'abc...', 
name: 'report.pdf',
size: 1048576,
checksum: 'sha256:abc123...',
folder_id: '789...',
storage_path: 'user123/abc123_report.pdf',
mime_type: 'application/pdf'
```

---

## Indexing Strategy

### **Performance Indexes**
```sql
-- User-based queries (most common)
CREATE INDEX idx_fm_folders_user_id ON fm_folders(user_id);
CREATE INDEX idx_fm_files_user_id ON fm_files(user_id);

-- Hierarchy navigation
CREATE INDEX idx_fm_folders_parent_id ON fm_folders(parent_id);
CREATE INDEX idx_fm_files_folder_id ON fm_files(folder_id);

-- Path-based queries (breadcrumbs)
CREATE INDEX idx_fm_folders_path ON fm_folders(path);

-- Deduplication lookups
CREATE INDEX idx_fm_files_checksum ON fm_files(checksum);

-- Recent files dashboard
CREATE INDEX idx_fm_files_created_at ON fm_files(created_at DESC);
```

### **Query Performance**
```sql
-- Folder listing (O(1) with index)
SELECT * FROM fm_folders 
WHERE user_id = $1 AND parent_id = $2;

-- File listing (O(1) with index) 
SELECT * FROM fm_files 
WHERE user_id = $1 AND folder_id = $2;

-- Recent files (O(log n) with index)
SELECT * FROM fm_files 
WHERE user_id = $1 
ORDER BY created_at DESC 
LIMIT 20;
```

---

## Materialized Path Pattern

### **Koncepcja**
Zamiast recursive queries, każdy folder przechowuje pełną ścieżkę od root.

```sql
-- Traditional approach (slow)
WITH RECURSIVE folder_tree AS (
  SELECT id, name, parent_id, 1 as level
  FROM folders WHERE parent_id IS NULL
  UNION ALL
  SELECT f.id, f.name, f.parent_id, ft.level + 1
  FROM folders f JOIN folder_tree ft ON f.parent_id = ft.id
)
SELECT * FROM folder_tree WHERE id = $folder_id;

-- Materialized path (fast)
SELECT id, name, path 
FROM fm_folders 
WHERE path LIKE '/Documents/%';
```

### **Path Generation Logic**
```sql
-- Root folder
path = '/'

-- Child folder  
path = parent_path + folder_name + '/'

-- Examples:
'/' → '/Documents/' → '/Documents/Reports/' → '/Documents/Reports/2023/'
```

### **Breadcrumb Generation**
```sql
-- Get folder hierarchy from path
SELECT id, name, path 
FROM fm_folders 
WHERE user_id = $1 
  AND path IN ('/Documents/', '/Documents/Reports/')
ORDER BY LENGTH(path);
```

---

## Row Level Security (RLS)

### **Security Model**
Każdy użytkownik widzi tylko swoje dane through automatic filtering.

#### **Folder Policies**
```sql
-- Read access
CREATE POLICY "Users can view their own folders" ON fm_folders
  FOR SELECT USING (
    user_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
  );

-- Write access  
CREATE POLICY "Users can insert their own folders" ON fm_folders
  FOR INSERT WITH CHECK (
    user_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
  );

-- Update access
CREATE POLICY "Users can update their own folders" ON fm_folders
  FOR UPDATE USING (
    user_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
  );

-- Delete access
CREATE POLICY "Users can delete their own folders" ON fm_folders
  FOR DELETE USING (
    user_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
  );
```

#### **File Policies**
```sql
-- Same pattern dla fm_files
CREATE POLICY "Users can view their own files" ON fm_files
  FOR SELECT USING (
    user_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
  );
-- ... inne policies analogicznie
```

### **JWT Token Integration**
```typescript
// JWT claims zawierają user ID
{
  "sub": "user-uuid-123",
  "email": "user@example.com", 
  "role": "authenticated"
}

// RLS używa 'sub' jako user_id
current_setting('request.jwt.claims', true)::json->>'sub'
```

---

## Database Triggers

### **Auto Root Folder Creation**
```sql
CREATE OR REPLACE FUNCTION create_user_root_folder()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.fm_folders (name, parent_id, user_id, path)
  VALUES ('Root', NULL, NEW.id, '/');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error ale nie blokuj rejestracji
  RAISE LOG 'Error creating root folder for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION create_user_root_folder();
```

### **Auto Timestamp Updates**
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fm_files_updated_at 
  BEFORE UPDATE ON fm_files 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## Data Integrity

### **Referential Integrity**
```sql
-- Cascading deletes
folder_id REFERENCES fm_folders(id) ON DELETE CASCADE
user_id REFERENCES auth.users(id) ON DELETE CASCADE

-- When user deleted → all folders & files deleted
-- When folder deleted → all subfolders & files deleted
```

### **Business Rules**
```sql
-- Cannot delete Root folder (application-level check)
-- Cannot move folder into its own subfolder (application-level check)
-- Cannot upload non-PDF files (application-level check)
-- File names must be unique within folder (future constraint)
```

### **Data Validation**
```sql
-- Size constraints
ALTER TABLE fm_files ADD CONSTRAINT check_positive_size 
CHECK (size > 0);

-- Path format validation
ALTER TABLE fm_folders ADD CONSTRAINT check_path_format
CHECK (path ~ '^/.*/$' OR path = '/');

-- MIME type validation
ALTER TABLE fm_files ADD CONSTRAINT check_pdf_only
CHECK (mime_type = 'application/pdf');
```

---

## Backup & Recovery

### **Supabase Automated Backups**
- Daily backups dla 7 dni (Free tier)
- Point-in-time recovery (Pro tier)
- Cross-region replication (Enterprise)

### **Data Export**
```sql
-- Full data export
COPY (
  SELECT f.*, fo.path as folder_path 
  FROM fm_files f 
  JOIN fm_folders fo ON f.folder_id = fo.id 
  WHERE f.user_id = $user_id
) TO 'user_files_export.csv' WITH CSV HEADER;
```

### **Disaster Recovery**
1. **Database**: Supabase automated backups
2. **Files**: Supabase Storage redundancy
3. **Application**: GitHub repository backup

---

## Performance Monitoring

### **Key Metrics**
```sql
-- Query performance
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC;

-- Table sizes
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE tablename LIKE 'fm_%';

-- Index usage
SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE schemaname = 'public';
```

### **Performance Optimization**
```sql
-- Query plan analysis
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM fm_files WHERE user_id = $1 AND folder_id = $2;

-- Index recommendations
SELECT * FROM pg_stat_user_tables WHERE n_tup_ins > 1000;
```

---

## Scalability Considerations

### **Current Scale (Demo)**
- ~1000 files per user
- ~100 folders per user
- Single region deployment

### **Medium Scale (10K users)**
- Connection pooling optimization
- Read replica dla read-heavy queries
- Partitioning by user_id

### **Large Scale (100K+ users)**
```sql
-- Table partitioning
CREATE TABLE fm_files_2024 PARTITION OF fm_files
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Sharding strategy
CREATE TABLE fm_files_shard_1 (LIKE fm_files INCLUDING ALL)
INHERITS (fm_files);
```

### **Query Optimization dla Scale**
```sql
-- Cursor-based pagination
SELECT * FROM fm_files 
WHERE user_id = $1 AND created_at < $cursor
ORDER BY created_at DESC 
LIMIT 50;

-- Prefix index dla path queries
CREATE INDEX idx_folders_path_prefix ON fm_folders 
USING btree (user_id, path text_pattern_ops);
```

---

## Migration Strategy

### **Schema Versioning**
```sql
-- Version tracking
CREATE TABLE schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example migration
INSERT INTO schema_migrations VALUES ('001_initial_schema');
INSERT INTO schema_migrations VALUES ('002_add_file_checksums');
```

### **Data Migration**
```sql
-- Add new column with default
ALTER TABLE fm_files ADD COLUMN tags JSONB DEFAULT '[]';

-- Populate existing data
UPDATE fm_files SET tags = '[]' WHERE tags IS NULL;

-- Make NOT NULL
ALTER TABLE fm_files ALTER COLUMN tags SET NOT NULL;
```

---

## Security Audit

### **Access Patterns**
```sql
-- Monitor RLS policy effectiveness
SELECT schemaname, tablename, 
       SUM(n_tup_ins) as inserts,
       SUM(n_tup_upd) as updates,
       SUM(n_tup_del) as deletes
FROM pg_stat_user_tables 
WHERE tablename LIKE 'fm_%'
GROUP BY schemaname, tablename;
```

### **Data Privacy**
- User data isolation przez RLS
- No cross-user data visibility
- Automatic cleanup przy user deletion
- GDPR compliance ready

### **Audit Trail**
```sql
-- Future: Add audit table
CREATE TABLE fm_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Development Workflow

### **Local Development**
```bash
# Supabase CLI setup
supabase init
supabase start
supabase db reset

# Apply migrations
supabase db push
```

### **Testing**
```sql
-- Test data setup
INSERT INTO fm_folders (name, user_id, path) VALUES 
('Test Folder', 'test-user', '/Test Folder/');

-- Clean test data
DELETE FROM fm_files WHERE user_id = 'test-user';
DELETE FROM fm_folders WHERE user_id = 'test-user';
```

### **Production Deployment**
1. **Schema changes**: Apply przez Supabase Dashboard
2. **Data migrations**: Run podczas maintenance window
3. **Rollback plan**: Database backup przed changes