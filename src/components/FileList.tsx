'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { File } from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  size: number;
  created_at: string;
  mime_type: string;
}

interface FileListProps {
  files: FileItem[];
  loading: boolean;
  selectedFiles: string[];
  onSelectionChange: (selectedFiles: string[]) => void;
  viewMode?: 'list' | 'grid';
}

export function FileList({ files, loading, selectedFiles, onSelectionChange, viewMode = 'list' }: FileListProps) {

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

  if (loading) {
    return <div className="text-center py-8">Loading files...</div>;
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No files in this folder. Upload some PDF files to get started.
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
          {selectedFiles.length > 0 ? `${selectedFiles.length} selected` : `${files.length} files`}
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
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedFiles.includes(file.id)}
                      onChange={() => handleSelectFile(file.id)}
                      className="rounded"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <File className="h-4 w-4 text-red-500" />
                      <span>{file.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{formatFileSize(file.size)}</TableCell>
                  <TableCell>{formatDate(file.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {files.map((file) => (
            <div
              key={file.id}
              className={`border rounded-lg p-4 hover:bg-gray-50 cursor-pointer ${
                selectedFiles.includes(file.id) ? 'border-blue-500 bg-blue-50' : ''
              }`}
              onClick={() => handleSelectFile(file.id)}
            >
              <div className="flex flex-col items-center space-y-2">
                <File className="h-8 w-8 text-red-500" />
                <div className="text-sm text-center">
                  <div className="font-medium truncate w-full">{file.name}</div>
                  <div className="text-gray-500">{formatFileSize(file.size)}</div>
                  <div className="text-gray-400 text-xs">{formatDate(file.created_at)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}