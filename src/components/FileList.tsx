'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { File, Folder } from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  size: number;
  created_at: string;
  mime_type: string;
  type: 'file';
}

interface FolderItem {
  id: string;
  name: string;
  created_at: string;
  type: 'folder';
}

type ListItem = FileItem | FolderItem;

interface FileListProps {
  files: FileItem[];
  folders: FolderItem[];
  loading: boolean;
  selectedFiles: string[];
  onSelectionChange: (selectedFiles: string[]) => void;
  onFolderClick: (folderId: string) => void;
  viewMode?: 'list' | 'grid';
}

export function FileList({ files, folders, loading, selectedFiles, onSelectionChange, onFolderClick, viewMode = 'list' }: FileListProps) {

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Combine folders and files into one list, folders first
  const allItems: ListItem[] = [
    ...folders.map(folder => ({ ...folder, type: 'folder' as const })),
    ...files.map(file => ({ ...file, type: 'file' as const }))
  ];

  const handleSelectAll = () => {
    if (selectedFiles.length === files.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(files.map(f => f.id));
    }
  };

  const handleSelectFile = (fileId: string) => {
    if (selectedFiles.includes(fileId)) {
      onSelectionChange(selectedFiles.filter(id => id !== fileId));
    } else {
      onSelectionChange([...selectedFiles, fileId]);
    }
  };

  const handleItemClick = (item: ListItem) => {
    if (item.type === 'folder') {
      onFolderClick(item.id);
    } else {
      handleSelectFile(item.id);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading files...</div>;
  }

  if (allItems.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        This folder is empty. Create a new folder or upload some PDF files to get started.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selection info */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={selectedFiles.length === files.length && files.length > 0}
          onChange={handleSelectAll}
          className="rounded"
        />
        <span className="text-sm text-gray-600">
          {selectedFiles.length > 0 ? `${selectedFiles.length} selected` : `${folders.length} folders, ${files.length} files`}
        </span>
      </div>

      {/* File list/grid */}
      {viewMode === 'list' ? (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Select</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Modified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allItems.map((item) => (
                <TableRow 
                  key={item.id} 
                  className={item.type === 'folder' ? 'cursor-pointer hover:bg-gray-50' : ''}
                  onClick={item.type === 'folder' ? () => onFolderClick(item.id) : undefined}
                >
                  <TableCell>
                    {item.type === 'file' && (
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(item.id)}
                        onChange={() => handleSelectFile(item.id)}
                        className="rounded"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {item.type === 'folder' ? (
                        <Folder className="h-4 w-4 text-blue-500" />
                      ) : (
                        <File className="h-4 w-4 text-red-500" />
                      )}
                      <span>{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.type === 'file' ? formatFileSize(item.size) : '—'}
                  </TableCell>
                  <TableCell>{formatDate(item.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {allItems.map((item) => (
            <div
              key={item.id}
              className={`border rounded-lg p-4 hover:bg-gray-50 cursor-pointer ${
                item.type === 'file' && selectedFiles.includes(item.id) ? 'border-blue-500 bg-blue-50' : ''
              }`}
              onClick={() => handleItemClick(item)}
            >
              <div className="flex flex-col items-center space-y-2">
                {item.type === 'folder' ? (
                  <Folder className="h-8 w-8 text-blue-500" />
                ) : (
                  <File className="h-8 w-8 text-red-500" />
                )}
                <div className="text-sm text-center">
                  <div className="font-medium truncate w-full">{item.name}</div>
                  <div className="text-gray-500">
                    {item.type === 'file' ? formatFileSize(item.size) : 'Folder'}
                  </div>
                  <div className="text-gray-400 text-xs">{formatDate(item.created_at)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}