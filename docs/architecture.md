# Dokumentacja Architektury

## Przegląd Architektury

File Manager został zaprojektowany jako nowoczesna, skalowalna aplikacja webowa wykorzystująca architekturę JAMstack z Supabase jako backend-as-a-service.

## High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   React App     │    │   Supabase      │    │   Netlify CDN   │
│   (Next.js)     │───▶│   Backend       │    │   (Hosting)     │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │
        │                        ├── PostgreSQL Database
        │                        ├── Authentication Service
        │                        ├── File Storage + CDN
        │                        └── Real-time Subscriptions
        │
        └── React Query Cache Layer
```

---

## Technology Stack

### **Frontend Layer**
- **Next.js 15** - React framework z App Router
- **TypeScript** - Type safety i developer experience
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - High-quality component library
- **React Query** - Data fetching i caching
- **Lucide Icons** - Modern icon library

### **Backend Layer (Supabase)**
- **PostgreSQL 15+** - Relational database
- **PostgREST** - Auto-generated REST API
- **Supabase Auth** - Authentication service
- **Supabase Storage** - File storage z CDN
- **Row Level Security** - Database-level authorization

### **Deployment Layer**
- **Netlify** - Static hosting platform
- **GitHub** - Version control i CI/CD
- **Static Export** - Next.js static site generation

---

## Application Architecture

### **Frontend Architecture (MVC Pattern)**

```
┌─────────────────────────────────────────────────────────────────┐
│                           React App                             │
├─────────────────────┬─────────────────────┬─────────────────────┤
│                     │                     │                     │
│      View Layer     │   Controller Layer  │     Model Layer     │
│   (Components)      │   (Event Handlers)  │   (Data & State)    │
│                     │                     │                     │
│  • FileManager      │  • handleUpload     │  • React Query      │
│  • FolderTree       │  • handleDelete     │  • supabaseApi      │
│  • FileList         │  • handleMove       │  • Zustand Store    │
│  • Breadcrumb       │  • handleCreate     │  • Local State      │
│                     │                     │                     │
└─────────────────────┴─────────────────────┴─────────────────────┘
```

### **Component Hierarchy**

```
App
├── Layout
│   ├── Header (Auth status, logout)
│   └── Main Content
│       ├── Sidebar
│       │   └── FolderTree
│       │       ├── TreeNode (recursive)
│       │       └── CreateFolderDialog
│       └── Content Area
│           ├── Breadcrumb Navigation
│           ├── Action Toolbar
│           │   ├── UploadDialog
│           │   ├── BulkActions
│           │   └── ViewToggle
│           ├── FileList
│           │   ├── ListView (Table)
│           │   └── GridView (Cards)
│           └── MoveFileDialog
```

---

## Data Flow Architecture

### **Client-Side Data Flow**

```
1. User Interaction
   ↓
2. Event Handler (FileManager)
   ↓
3. React Query Mutation
   ↓
4. supabaseApi Call
   ↓
5. HTTP Request to Supabase
   ↓
6. Database Operation
   ↓
7. Response Back to Client
   ↓
8. React Query Cache Update
   ↓
9. Automatic UI Re-render
```

### **State Management Strategy**

#### **Server State (React Query)**
- Cache folder structure
- Cache file listings
- Cache user session
- Optimistic updates
- Background refetching

#### **Client State (React useState)**
- UI state (dialogs, selections)
- Form inputs
- View preferences
- Navigation state

#### **Global State (Future: Zustand)**
- User preferences
- Theme settings
- Application settings

---

## Security Architecture

### **Authentication Flow**

```
1. User Login → Supabase Auth
2. JWT Token Generated
3. Token Stored in Browser
4. All API Calls Include Token
5. Supabase Validates Token
6. RLS Policies Apply
```

### **Authorization Model (RLS)**

#### **Row Level Security Policies**
```sql
-- Users can only see their own data
CREATE POLICY "user_isolation" ON fm_folders
  FOR ALL USING (
    user_id::text = current_setting('request.jwt.claims', true)::json->>'sub'
  );
```

#### **Data Isolation Strategy**
- Database-level security (nie application-level)
- JWT claims validation
- Automatic user filtering
- Zero-trust model

### **File Storage Security**
- User-scoped file paths: `{user_id}/{file_id}_{filename}`
- Public bucket z RLS policies
- No direct file access without auth
- Storage path obfuscation

---

## Database Architecture

### **Schema Design Principles**

#### **Materialized Path Pattern**
```
Root: path = "/"
Level 1: path = "/Documents/"
Level 2: path = "/Documents/Reports/"
Level 3: path = "/Documents/Reports/2023/"
```

**Benefits:**
- O(1) parent lookup
- Efficient breadcrumb generation
- No recursive queries needed
- Scalable to deep hierarchies

#### **Table Relationships**
```
auth.users (Supabase)
    ↓ (user_id)
fm_folders
    ↓ (folder_id)
fm_files
    ↓ (storage_path)
storage.objects (Supabase)
```

### **Indexing Strategy**
- User-based queries (most common)
- Hierarchy navigation
- Path-based queries
- Deduplication lookups
- Temporal queries (recent files)

---

## Performance Architecture

### **Caching Strategy**

#### **Multi-Layer Caching**
1. **Browser Cache** - Static assets (JS, CSS, images)
2. **React Query Cache** - API responses (5-minute stale time)
3. **Supabase Cache** - Query plans and connections
4. **CDN Cache** - File downloads and static content

#### **Cache Invalidation**
```typescript
// Granular invalidation
queryClient.invalidateQueries({ queryKey: ['files', folderId] });

// Cascading invalidation
queryClient.invalidateQueries({ queryKey: ['folders'] });

// Complete cache clear (logout)
queryClient.clear();
```

### **Optimization Techniques**

#### **Lazy Loading**
- Folder tree expands on demand
- Files load only dla current folder
- Components load tylko when needed

#### **Pagination Ready**
- LIMIT/OFFSET dla current scale
- Cursor-based pagination dla future scale
- Virtual scrolling ready

#### **Bundle Optimization**
- Next.js automatic code splitting
- Dynamic imports dla heavy libraries
- Tree shaking enabled

---

## Scalability Architecture

### **Current Scale (Demo)**
```
Users: ~100
Files per user: ~1,000
Total files: ~100K
Database size: <1GB
Traffic: Low
```

### **Medium Scale (Production)**
```
Users: ~10K
Files per user: ~10K
Total files: ~100M
Database size: ~100GB
Traffic: Medium

Optimizations needed:
- Read replicas
- Connection pooling
- Advanced indexing
- CDN optimization
```

### **Large Scale (Enterprise)**
```
Users: ~1M+
Files per user: ~100K+
Total files: ~100B+
Database size: ~10TB+
Traffic: High

Architecture changes needed:
- Microservices
- Database sharding
- Event-driven architecture
- Multi-region deployment
```

---

## API Architecture

### **RESTful Design Principles**

#### **Resource-Oriented URLs**
```
GET /folders          - List folders
POST /folders         - Create folder
DELETE /folders/:id   - Delete folder

GET /files            - List files
POST /files           - Upload file
DELETE /files/:id     - Delete file
PUT /files/:id/move   - Move file
```

#### **HTTP Methods Mapping**
- **GET** - Read operations (SELECT)
- **POST** - Create operations (INSERT)
- **PUT/PATCH** - Update operations (UPDATE) 
- **DELETE** - Delete operations (DELETE)

### **Error Handling Strategy**

#### **HTTP Status Codes**
- **200** - Success
- **201** - Created
- **400** - Bad Request (validation error)
- **401** - Unauthorized
- **403** - Forbidden (RLS violation)
- **404** - Not Found
- **500** - Internal Server Error

#### **Error Response Format**
```typescript
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "File name cannot be empty",
    "details": {...}
  }
}
```

---

## File System Architecture

### **Storage Strategy**

#### **File Organization**
```
files/
├── user-1/
│   ├── file-1_document.pdf
│   ├── file-2_report.pdf
│   └── file-3_presentation.pdf
├── user-2/
│   ├── file-4_invoice.pdf
│   └── file-5_contract.pdf
└── user-3/
    └── file-6_manual.pdf
```

#### **File Processing Pipeline**
```
1. Client Upload
   ↓
2. File Validation (type, size)
   ↓
3. Supabase Storage Upload
   ↓
4. Checksum Generation
   ↓
5. Database Metadata Save
   ↓
6. Cache Invalidation
   ↓
7. UI Update
```

### **Deduplication Strategy**
- Checksum-based detection
- User-scoped deduplication
- Future: Global deduplication
- Storage optimization

---

## Deployment Architecture

### **CI/CD Pipeline**

```
GitHub Repository
   ↓ (git push)
GitHub Actions
   ↓ (build)
Static Files
   ↓ (deploy)
Netlify CDN
   ↓ (serve)
Global Users
```

#### **Build Process**
1. **Install Dependencies** - npm install
2. **Type Checking** - TypeScript compilation
3. **Static Generation** - Next.js export
4. **Asset Optimization** - Minification, compression
5. **Deploy to CDN** - Netlify global distribution

#### **Environment Configuration**
```
Development: .env.local
Staging: Netlify environment variables
Production: Netlify environment variables
```

---

## Monitoring & Observability

### **Logging Strategy**

#### **Client-Side Logging**
```typescript
// API calls
console.log('Moving file:', { fileId, newFolderId });

// Errors
console.error('API Error:', { error, context });

// Performance
console.time('File upload');
console.timeEnd('File upload');
```

#### **Server-Side Monitoring**
- Supabase Dashboard metrics
- Database query performance
- Storage usage analytics
- Authentication events

### **Error Tracking**
- React Error Boundaries
- Console error monitoring
- Network failure handling
- Graceful degradation

---

## Security Considerations

### **Frontend Security**
- XSS prevention przez React
- CSRF protection przez SameSite cookies
- Input validation
- Secure file handling

### **Backend Security**
- SQL injection prevention przez PostgREST
- Row Level Security enforcement
- JWT token validation
- Rate limiting (Supabase built-in)

### **Transport Security**
- HTTPS everywhere
- Secure cookie settings
- CORS configuration
- Content Security Policy ready

---

## Future Architecture Considerations

### **Planned Enhancements**

#### **Performance**
1. **Virtual Scrolling** - Handle large file lists
2. **Service Worker** - Offline capabilities
3. **Progressive Web App** - Mobile experience
4. **Real-time Updates** - Supabase subscriptions

#### **Functionality**
1. **File Previews** - PDF rendering
2. **Advanced Search** - Full-text search
3. **File Sharing** - Public/private links
4. **Collaboration** - Real-time editing

#### **Scalability**
1. **Microservices** - Service decomposition
2. **Event Sourcing** - Audit trail
3. **CQRS Pattern** - Read/write separation
4. **Multi-tenant** - Organization support

### **Migration Strategies**

#### **Database Migration**
- Schema versioning
- Blue-green deployments
- Rollback procedures
- Data consistency checks

#### **Application Migration**
- Feature flags
- Gradual rollouts
- A/B testing
- User feedback loops

---

## Technical Debt & Maintenance

### **Current Technical Debt**
- Simplified checksum implementation
- Client-side ZIP generation
- Basic error handling
- Limited offline support

### **Maintenance Schedule**
- **Daily**: Monitoring dashboard check
- **Weekly**: Performance review
- **Monthly**: Security audit
- **Quarterly**: Architecture review

### **Upgrade Strategy**
- Next.js version updates
- Dependency security patches
- Database schema evolution
- API versioning strategy

---

## Development Workflow

### **Code Organization**
```
src/
├── components/          # React components
├── lib/                 # Utilities and API
├── app/                 # Next.js App Router
├── types/               # TypeScript definitions
└── styles/              # Global styles

docs/                    # Documentation
tests/                   # Test files
public/                  # Static assets
```

### **Coding Standards**
- TypeScript strict mode
- ESLint configuration
- Prettier formatting
- Component naming conventions

### **Testing Strategy**
- Unit tests dla utilities
- Component testing
- Integration testing
- E2E testing scenarios

---

## Conclusion

File Manager został zaprojektowany z myślą o skalowalności, bezpieczeństwie i wydajności. Architektura JAMstack z Supabase zapewnia solidne podstawy dla przyszłego rozwoju, a zastosowane wzorce projektowe umożliwiają łatwe wprowadzanie nowych funkcjonalności.

Kluczowe zalety architektury:
- **Separation of Concerns** - Jasny podział odpowiedzialności
- **Scalability** - Możliwość skalowania każdej warstwy niezależnie
- **Security** - Database-level authorization
- **Performance** - Multi-layer caching i optymalizacje
- **Maintainability** - Modularna struktura i dokumentacja