# Dokumentacja API

## Przegląd API

File Manager wykorzystuje **Supabase** jako backend-as-a-service, zapewniający:
- PostgreSQL database z Row Level Security
- Real-time subscriptions
- Authentication system
- File storage z CDN

## Architektura API

### **Direct Client-to-Supabase**
```
React App → supabaseApi → Supabase → PostgreSQL
```

**Zalety tego podejścia:**
- Eliminacja middleware layer
- Automatic caching w React Query
- Real-time capabilities out-of-the-box
- Reduced latency

---

## supabaseApi Interface

### **Authentication Methods**

#### `signUp(email: string, password: string)`
```typescript
// Rejestracja nowego użytkownika
const result = await supabaseApi.signUp('user@example.com', 'password123');
```

**Response:**
```typescript
{
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}
```

**Side Effects:**
- Automatyczne utworzenie folderu "Root" przez database trigger
- Email verification jeśli włączone

---

#### `signIn(email: string, password: string)`
```typescript
// Logowanie użytkownika
const result = await supabaseApi.signIn('user@example.com', 'password123');
```

**Response:**
```typescript
{
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}
```

---

#### `signOut()`
```typescript
// Wylogowanie użytkownika
await supabaseApi.signOut();
```

**Side Effects:**
- Invalidacja wszystkich query cache
- Redirect do login screen

---

#### `getUser()`
```typescript
// Pobranie aktualnego użytkownika
const user = await supabaseApi.getUser();
```

---

### **Folder Management**

#### `getFolders(parentId?: string, limit = 50, offset = 0)`
```typescript
// Pobranie folderów (root level)
const rootFolders = await supabaseApi.getFolders();

// Pobranie subfolderów
const subfolders = await supabaseApi.getFolders('folder-uuid');
```

**SQL Query:**
```sql
SELECT * FROM fm_folders 
WHERE parent_id = $parentId OR parent_id IS NULL
ORDER BY name
LIMIT $limit OFFSET $offset
```

**Response:**
```typescript
interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  user_id: string;
  path: string;
  created_at: string;
}
```

---

#### `createFolder(name: string, parentId?: string)`
```typescript
// Utworzenie nowego folderu
const folder = await supabaseApi.createFolder('My Documents', 'parent-uuid');
```

**Logic:**
1. Validate user authentication
2. Build materialized path z parent folder
3. Insert do fm_folders table
4. Return nowy folder object

**Materialized Path Pattern:**
```typescript
// Root folder: path = "/"
// Subfolder: path = "/Documents/"
// Nested: path = "/Documents/Images/"
```

---

#### `deleteFolder(id: string)`
```typescript
// Usunięcie folderu (CASCADE delete dla subfolderów i plików)
await supabaseApi.deleteFolder('folder-uuid');
```

**CASCADE Behavior:**
- Usuwa wszystkie subfoldery
- Usuwa wszystkie pliki w folderze
- Usuwa z Supabase Storage

---

#### `getFolderBreadcrumbs(folderId: string)`
```typescript
// Generowanie breadcrumb navigation
const breadcrumbs = await supabaseApi.getFolderBreadcrumbs('folder-uuid');
```

**Algorithm:**
1. Parse materialized path
2. Query folders by path segments
3. Order by path depth
4. Return hierarchical array

---

### **File Management**

#### `getFiles(folderId?: string, limit = 50, offset = 0)`
```typescript
// Pobranie plików z folderu
const files = await supabaseApi.getFiles('folder-uuid');

// Wszystkie pliki użytkownika (dla search)
const allFiles = await supabaseApi.getFiles();
```

**SQL Query:**
```sql
SELECT * FROM fm_files 
WHERE folder_id = $folderId 
ORDER BY name
LIMIT $limit OFFSET $offset
```

---

#### `getRecentFiles(limit = 20)`
```typescript
// Najnowsze pliki dla dashboard
const recentFiles = await supabaseApi.getRecentFiles();
```

**SQL Query:**
```sql
SELECT * FROM fm_files 
ORDER BY created_at DESC 
LIMIT $limit
```

---

#### `uploadFile(file: File, folderId: string)`
```typescript
// Upload pliku PDF
const uploadedFile = await supabaseApi.uploadFile(pdfFile, 'folder-uuid');
```

**Process:**
1. **Validation**: Check file type (PDF only)
2. **Storage**: Upload do Supabase Storage bucket 'files'
3. **Metadata**: Save do fm_files table
4. **Checksum**: Generate dla deduplication
5. **Path**: `{user_id}/{file_id}_{filename}`

**Storage Structure:**
```
files/
├── user-uuid-1/
│   ├── file-uuid-1_document.pdf
│   └── file-uuid-2_report.pdf
└── user-uuid-2/
    └── file-uuid-3_presentation.pdf
```

---

#### `deleteFile(id: string)`
```typescript
// Usunięcie pliku
await supabaseApi.deleteFile('file-uuid');
```

**Process:**
1. Query file metadata dla storage_path
2. Delete z Supabase Storage
3. Delete z fm_files table

---

#### `moveFile(fileId: string, newFolderId: string)`
```typescript
// Przeniesienie pliku do innego folderu
const movedFile = await supabaseApi.moveFile('file-uuid', 'target-folder-uuid');
```

**Implementation (UPSERT approach):**
```typescript
// 1. Fetch current file data
const currentFile = await supabase
  .from('fm_files')
  .select('*')
  .eq('id', fileId)
  .single();

// 2. Upsert z new folder_id (avoids CORS PATCH issues)
const result = await supabase
  .from('fm_files')
  .upsert({
    ...currentFile,
    folder_id: newFolderId,
    updated_at: new Date().toISOString()
  });
```

---

#### `downloadFiles(fileIds: string[])`
```typescript
// Download multiple files jako ZIP
const zipBlob = await supabaseApi.downloadFiles(['file1', 'file2']);
```

**Process:**
1. Query file metadata dla każdego file ID
2. Download files z Supabase Storage
3. Create ZIP using JSZip (client-side)
4. Return Blob dla download

**Client-side ZIP Generation:**
```typescript
const JSZip = await import('jszip');
const zip = new JSZip();

for (const fileId of fileIds) {
  const fileData = await supabase.storage
    .from('files')
    .download(file.storage_path);
  
  zip.file(file.name, fileData);
}

return await zip.generateAsync({ type: 'blob' });
```

---

### **Storage URLs**

#### `getFileUrl(storagePath: string)`
```typescript
// Generowanie public URL dla pliku
const url = supabaseApi.getFileUrl('user-uuid/file-uuid_document.pdf');
```

**Generated URL Format:**
```
https://project.supabase.co/storage/v1/object/public/files/user-uuid/file-uuid_document.pdf
```

---

## Row Level Security (RLS)

### **Policies Overview**

**Folders (fm_folders):**
```sql
-- Users can only see their own folders
CREATE POLICY "Users can view their own folders" ON fm_folders
  FOR SELECT USING (
    user_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
  );
```

**Files (fm_files):**
```sql
-- Users can only see their own files
CREATE POLICY "Users can view their own files" ON fm_files
  FOR SELECT USING (
    user_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
  );
```

### **JWT Claims Pattern**
```typescript
// JWT payload contains user ID
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "authenticated"
}

// RLS uses 'sub' claim jako user_id
current_setting('request.jwt.claims', true)::json->>'sub'
```

---

## Error Handling

### **Standard Error Response**
```typescript
interface SupabaseError {
  message: string;
  details: string;
  hint: string;
  code: string;
}
```

### **Common Error Codes**
- `23505` - Unique constraint violation
- `42501` - Insufficient privileges (RLS)
- `23503` - Foreign key violation
- `PGRST116` - Row Level Security violation

### **Client Error Handling**
```typescript
try {
  const result = await supabaseApi.createFolder(name, parentId);
} catch (error) {
  if (error.code === '23505') {
    alert('Folder name already exists');
  } else if (error.code === '42501') {
    alert('Permission denied');
  } else {
    console.error('Unexpected error:', error);
    alert('An error occurred. Please try again.');
  }
}
```

---

## Performance Considerations

### **Query Optimization**
1. **Indexes** na często używane kolumny:
   - `fm_folders.user_id`
   - `fm_folders.parent_id`
   - `fm_files.folder_id`
   - `fm_files.user_id`

2. **Pagination** dla large datasets:
   - LIMIT/OFFSET dla prostych queries
   - Cursor-based pagination dla scale

3. **Materialized Paths** dla hierarchy:
   - O(1) parent lookup zamiast recursive CTE
   - Efficient breadcrumb generation

### **Caching Strategy**
1. **React Query** cache:
   - 5-minute stale time
   - Background refetching
   - Optimistic updates

2. **Supabase Built-in**:
   - Connection pooling
   - Query plan caching
   - PostgREST optimizations

---

## Security Best Practices

### **Authentication**
- JWT tokens z expiration
- Refresh token rotation
- Session management

### **Authorization**
- Row Level Security enforced
- User isolation na database level
- No server-side session storage needed

### **Data Validation**
- Client-side validation dla UX
- Database constraints dla integrity
- File type restrictions (PDF only)

### **Storage Security**
- User-scoped file paths
- Public bucket z RLS policies
- No direct file access without auth

---

## Monitoring & Debugging

### **Logging Strategy**
```typescript
// API calls z detailed logging
console.log('Moving file:', { fileId, newFolderId });
console.error('API Error:', { error, context });
```

### **Supabase Dashboard**
- Real-time query monitoring
- Performance insights
- Error tracking
- Usage analytics

### **Client-side Monitoring**
- React Query DevTools
- Network tab monitoring
- Console error tracking

---

## Scalability Roadmap

### **Current (Demo Scale)**
- ~1000 files per user
- Simple pagination
- Client-side ZIP generation

### **Production Scale (1M+ files)**
- Cursor-based pagination
- Server-side ZIP generation
- CDN dla file downloads
- Database read replicas
- Connection pooling optimization

### **Enterprise Scale**
- Microservices decomposition
- Event-driven architecture
- Advanced caching layers
- Multi-region deployment