# Scalable File Management System - Supabase Edition

A modern file management application built with Next.js and Supabase, designed to handle millions of files with deep folder nesting. This version leverages Supabase for authentication, database, and file storage.

## 🚀 Quick Start

### Prerequisites
- Node.js 18 or higher
- npm
- Supabase account (free tier works perfectly)

### Installation

1. Install dependencies
```bash
npm install
```

2. Set up Supabase project
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Copy your Project URL and anon public key

3. Set up environment variables
```bash
cp .env.example .env.local
```

4. Configure environment variables in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

5. Set up database tables
   - Open Supabase SQL Editor
   - Run the SQL from `supabase-setup.sql`
   - Run the SQL from `supabase-storage-policy.sql`

6. Set up Storage
   - Go to Storage in Supabase dashboard
   - Create a bucket named "files"
   - Make it public

7. Start development server
```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## 📋 Core Features

### Authentication & User Management
- Secure JWT-based authentication
- User registration and login
- Isolated file spaces per user
- Session persistence with localStorage

### File Management
- **PDF-only uploads** (as per requirements)
- Create and delete folders with unlimited nesting depth
- Visual folder tree navigation with breadcrumbs
- File operations: upload, delete, move between folders
- Recent files dashboard showing last 20 uploaded files

### Batch Operations & Downloads
- Multiple file selection with checkboxes
- Bulk delete operations
- **ZIP download functionality** with async processing
- Real-time status updates for ZIP generation
- Smart caching with file checksums to avoid duplicate work

### User Interface
- Built with **shadcn/ui** components
- Responsive design for mobile and desktop
- List/grid view toggle for files
- Loading states and error handling
- Optimistic updates for better UX

## 🏗️ Architecture & Scalability

### Database Design
The application uses **SQLite** for demo purposes but is designed for scalability:

- **Materialized Path Pattern** for folders to handle deep nesting efficiently
- **Indexed queries** for fast file lookups
- **Checksum-based deduplication** to prevent storing identical files
- **Optimized pagination** using LIMIT/OFFSET with proper indexes

#### Key Tables:
- `users` - User accounts with JWT authentication
- `folders` - Hierarchical folder structure with path materialization
- `files` - File metadata with checksums for deduplication
- `zip_jobs` - Asynchronous ZIP generation tracking

### Scalability Approach

#### Handling Millions of Files
1. **Database Indexing Strategy:**
   - `idx_folders_user_id` - Fast user folder queries
   - `idx_folders_path` - Efficient path-based lookups
   - `idx_files_folder_id` - Quick file listing by folder
   - `idx_files_checksum` - Fast duplicate detection

2. **Pagination Implementation:**
   - **Cursor-based pagination** ready for implementation (currently using offset for demo)
   - 50 items per page default with configurable limits
   - **React Query infinite queries** for seamless loading

3. **Deep Folder Nesting:**
   - **Materialized path pattern** instead of recursive queries
   - Path-based indexing for O(1) ancestor lookups
   - Efficient breadcrumb generation

#### React Query Caching Strategy
- **5-minute stale time** for folder contents
- **Optimistic updates** for immediate UI feedback
- **Background refetching** to keep data fresh
- **Query invalidation** on mutations for consistency

### Queue System & Caching

#### ZIP Generation Queue
- **In-memory queue** for demo (Redis recommended for production)
- **Asynchronous processing** prevents UI blocking
- **Status tracking** with real-time updates
- **Temporary file cleanup** after download

#### Smart Caching Mechanism
- **SHA256 checksums** for all uploaded files
- **Duplicate detection** prevents redundant storage
- **ZIP result caching** (1-hour TTL) for identical file sets
- **Optimized for repeated downloads** of same file combinations

## 🛠️ Technology Stack

### Frontend
- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **React Query (TanStack Query)** for state management and caching
- **Lucide React** for icons

### Backend & Services
- **Supabase** - PostgreSQL database with real-time features
- **Supabase Auth** - Authentication with Row Level Security
- **Supabase Storage** - File storage with CDN
- **JSZip** for client-side ZIP generation
- **UUID** for unique identifiers

### Deployment
- **Netlify** ready deployment
- **Vercel** compatible
- **Environment variable** support
- **Global CDN** through Supabase

## 📊 Performance Considerations

### Database Optimizations
- **Materialized paths** for O(1) folder hierarchy queries
- **Composite indexes** for common query patterns
- **Checksum indexing** for fast duplicate detection
- **Pagination** to limit memory usage

### Frontend Optimizations
- **React Query** for intelligent caching and background updates
- **Optimistic updates** for immediate UI feedback
- **Virtual scrolling** consideration for very large file lists
- **Lazy loading** of folder contents

### Scalability Improvements for Production
1. **Database Migration:**
   - PostgreSQL with connection pooling
   - Read replicas for query scaling
   - Partitioning for large tables

2. **File Storage:**
   - Move to cloud storage (S3, Cloudinary)
   - CDN for file downloads
   - Streaming uploads for large files

3. **Queue System:**
   - Redis with Bull queue
   - Horizontal scaling with multiple workers
   - Job persistence and retry logic

4. **Caching Layer:**
   - Redis for application caching
   - CDN for static assets
   - Edge caching for API responses

## 🔧 Development

### Project Structure
```
src/
├── app/                  # Next.js App Router
│   ├── api/             # API endpoints
│   └── page.tsx         # Main application
├── components/          # React components
│   ├── ui/             # shadcn/ui components
│   └── providers/      # Context providers
└── lib/                # Utilities and services
    ├── auth.ts         # JWT authentication
    ├── database.ts     # Database operations
    ├── api.ts          # API client
    ├── queue.ts        # Job queue system
    └── zip.ts          # ZIP generation
```

### API Endpoints
- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - User registration
- `GET/POST /api/folders` - Folder management
- `GET/POST /api/files` - File operations
- `POST /api/zip` - ZIP job creation
- `GET /api/zip/[id]` - ZIP download

### Build and Deploy
```bash
# Local development
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## 📝 Trade-offs & Future Improvements

### Current Limitations
1. **SQLite** is used for demo - would use PostgreSQL in production
2. **In-memory queue** - would use Redis/Bull for production
3. **Local file storage** - would use cloud storage for scaling
4. **Basic pagination** - would implement cursor-based for better performance

### With More Time, I Would Add:
1. **File search and filtering** by name, date, size
2. **Drag-and-drop** file upload and folder organization
3. **File preview** for PDFs
4. **Folder zipping** in addition to multiple file zipping
5. **Activity logs** and audit trail
6. **File sharing** with permission management
7. **Advanced caching** with Redis
8. **Real-time collaboration** features
9. **File versioning** system
10. **Comprehensive test suite**

### Production Considerations
1. **Security:** Input validation, rate limiting, CORS configuration
2. **Monitoring:** Error tracking, performance metrics, logging
3. **Backup:** Database backups, file redundancy
4. **Documentation:** API documentation with Swagger/OpenAPI

## 🎯 Demo Account

For evaluation purposes, you can:
1. Register a new account at the deployed URL
2. Use any email/password combination
3. Start by creating folders and uploading PDF files
4. Test bulk operations and ZIP downloads

The application demonstrates scalable thinking while remaining functional within the 2-3 hour time constraint.
