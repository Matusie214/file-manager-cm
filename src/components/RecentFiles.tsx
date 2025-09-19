'use client';

import { File } from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  size: number;
  created_at: string;
}

interface RecentFilesProps {
  files: FileItem[];
}

export function RecentFiles({ files }: RecentFilesProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No files uploaded yet. Start by creating a folder and uploading some PDF files.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {files.slice(0, 10).map((file) => (
        <div key={file.id} className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg">
          <File className="h-5 w-5 text-red-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <span>{formatFileSize(file.size)}</span>
              <span>•</span>
              <span>{formatDate(file.created_at)}</span>
            </div>
          </div>
        </div>
      ))}
      
      {files.length > 10 && (
        <div className="text-center pt-4">
          <p className="text-sm text-gray-500">
            And {files.length - 10} more files...
          </p>
        </div>
      )}
    </div>
  );
}