# Dokumentacja Komponentów

## Przegląd Architektury Komponentów

Aplikacja File Manager została zbudowana w architekturze komponentowej React z wykorzystaniem TypeScript i shadcn/ui.

## Struktura Komponentów

### 📁 Core Components

#### **FileManager.tsx**
Główny komponent aplikacji zarządzający stanem i orchestrujący wszystkie operacje.

**Props:**
```typescript
interface FileManagerProps {
  user: User;
  onLogout: () => void;
}
```

**Stan:**
- `currentFolderId` - ID aktualnego folderu
- `selectedFiles` - lista zaznaczonych plików
- `viewMode` - tryb wyświetlania (list/grid)

**Główne funkcje:**
- Zarządzanie folderami (tworzenie, usuwanie)
- Upload plików PDF
- Operacje bulk (delete, download, move)
- Cache invalidation przez React Query

---

#### **FolderTree.tsx**
Komponent drzewa folderów z obsługą deep nesting.

**Props:**
```typescript
interface FolderTreeProps {
  currentFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
}
```

**Funkcjonalności:**
- Expandowalne drzewo folderów
- Lazy loading subfolderów
- Visual feedback dla aktualnego folderu
- Delete folder z confirmation

**State Management:**
- `expandedFolders: Set<string>` - lista rozwiniętych folderów
- React Query cache dla folderów i subfolderów

---

#### **FileList.tsx**
Komponent wyświetlania listy plików z obsługą selection.

**Props:**
```typescript
interface FileListProps {
  files: FileItem[];
  loading: boolean;
  selectedFiles: string[];
  onSelectionChange: (selectedFiles: string[]) => void;
  viewMode?: 'list' | 'grid';
}
```

**View Modes:**
- **List View**: Tabela z kolumnami (Name, Size, Modified)
- **Grid View**: Karty plików w siatce

**Funkcjonalności:**
- Multiple selection z checkboxami
- Select All/None
- File metadata display
- Responsive design

---

#### **Breadcrumb.tsx**
Komponent nawigacji hierarchii folderów.

**Props:**
```typescript
interface BreadcrumbProps {
  currentFolderId: string | null;
  breadcrumbs: BreadcrumbItem[];
  onNavigate: (folderId: string | null) => void;
}
```

**Funkcjonalności:**
- Clickable path navigation
- Home/Dashboard shortcut
- Current folder highlight
- Auto-generation z materialized paths

---

#### **MoveFileDialog.tsx**
Modal do przenoszenia plików między folderami.

**Props:**
```typescript
interface MoveFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoveFiles: (targetFolderId: string) => void;
  selectedCount: number;
}
```

**Funkcjonalności:**
- Folder tree navigation
- Target folder selection
- Bulk move preview
- Cancel/confirm actions

---

### 📁 UI Components (shadcn/ui)

#### **Używane komponenty:**
- `Button` - akcje użytkownika
- `Card` - kontenery sekcji
- `Dialog` - modale (upload, create folder, move)
- `Input` - formularze
- `Table` - list view plików

### 📁 Provider Components

#### **QueryProvider.tsx**
Globalne zarządzanie React Query.

**Konfiguracja:**
```typescript
{
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minut
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
}
```

**Auth State Handling:**
- Auto-clear cache przy logout
- Session change detection

---

## Wzorce Projektowe

### 1. **Container/Presentation Pattern**
- `FileManager` = Container (logika, stan)
- `FileList`, `FolderTree` = Presentation (UI, props)

### 2. **Compound Components**
- `Dialog` + `DialogContent` + `DialogHeader`
- `Card` + `CardContent` + `CardHeader`

### 3. **Render Props Pattern**
- `MoveFileDialog` przyjmuje `renderFolder` function

### 4. **Custom Hooks Pattern**
- React Query hooks dla data fetching
- Mutations z optimistic updates

---

## Data Flow

```
User Action → FileManager → supabaseApi → Supabase → React Query → UI Update
```

1. **User Interaction** → Button click, selection change
2. **Event Handler** → W FileManager component
3. **API Call** → Przez supabaseApi abstraction
4. **Database Operation** → Supabase PostgreSQL
5. **Cache Update** → React Query invalidation
6. **UI Re-render** → Automatic przez React Query

---

## Performance Optimizations

### 1. **React Query Caching**
- 5-minute stale time dla folderów
- Background refetching
- Optimistic updates

### 2. **Lazy Loading**
- Subfolders load tylko gdy expanded
- Files load tylko dla aktualnego folderu

### 3. **Memoization**
- React Query automatic memoization
- Stable query keys

### 4. **Virtual Scrolling Ready**
- Component structure prepared dla virtual scrolling
- Pagination support built-in

---

## Error Handling

### 1. **Component Level**
- Loading states dla każdego async operation
- Error boundaries ready
- User feedback przez alerts

### 2. **API Level**
- Try/catch w mutations
- Detailed error logging
- Graceful degradation

### 3. **Network Level**
- Retry logic w React Query
- CORS error handling
- Offline detection ready

---

## Accessibility

### 1. **Keyboard Navigation**
- Tab order preserved
- Enter/Space dla buttons
- Arrow keys dla tree navigation

### 2. **Screen Readers**
- Semantic HTML
- ARIA labels gdzie potrzeba
- Role attributes

### 3. **Visual Indicators**
- Focus states
- Loading indicators
- Error messages

---

## Testing Strategy

### 1. **Unit Tests**
- Individual component rendering
- Props validation
- Event handlers

### 2. **Integration Tests**
- Component interactions
- API integration
- State management

### 3. **E2E Tests**
- User workflows
- File operations
- Error scenarios

---

## Future Enhancements

### 1. **Performance**
- Virtual scrolling dla large lists
- Image thumbnails z lazy loading
- Progressive Web App features

### 2. **Functionality**
- Drag & drop
- File preview
- Advanced search/filtering

### 3. **UX**
- Keyboard shortcuts
- Bulk operations improvements
- Real-time collaboration
