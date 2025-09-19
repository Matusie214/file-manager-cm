'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { supabaseApi, type Folder } from '@/lib/supabase-api';
import { ChevronRight, ChevronDown, Folder as FolderIcon, Home } from 'lucide-react';

interface FolderTreeProps {
  currentFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
}

export function FolderTree({ currentFolderId, onFolderSelect }: FolderTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Get root folders
  const { data: rootFolders = [] } = useQuery({
    queryKey: ['folders', null],
    queryFn: () => supabaseApi.getFolders(),
  });

  // Debug: Log folder data
  console.log('FolderTree rootFolders:', rootFolders);

  // Get subfolders for expanded folders
  const subfolderResults = useQuery({
    queryKey: ['subfolders', Array.from(expandedFolders)],
    queryFn: async () => {
      const results: Record<string, Folder[]> = {};
      for (const folderId of expandedFolders) {
        results[folderId] = await supabaseApi.getFolders(folderId);
      }
      return results;
    },
    enabled: expandedFolders.size > 0,
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (folderId: string) => supabaseApi.deleteFolder(folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleDeleteFolder = (e: React.MouseEvent, folderId: string, folderName: string) => {
    e.stopPropagation();
    if (confirm(`Delete folder "${folderName}"? This will also delete all files inside.`)) {
      deleteFolderMutation.mutate(folderId);
    }
  };

  const renderFolder = (folder: Folder, level = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = currentFolderId === folder.id;
    const subfolders = subfolderResults.data?.[folder.id] || [];

    return (
      <div key={folder.id}>
        <div
          className={`flex items-center space-x-2 p-2 hover:bg-gray-100 cursor-pointer rounded ${
            isSelected ? 'bg-blue-100' : ''
          }`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => onFolderSelect(folder.id)}
        >
          <Button
            variant="ghost"
            size="sm"
            className="p-0 h-4 w-4"
            onClick={(e) => {
              e.stopPropagation();
              toggleFolder(folder.id);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
          <FolderIcon className="h-4 w-4 text-blue-500" />
          <span className="text-sm flex-1">{folder.name}</span>
          {folder.name !== 'Root' && (
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-4 w-4 text-red-500 hover:text-red-700"
              onClick={(e) => handleDeleteFolder(e, folder.id, folder.name)}
            >
              ×
            </Button>
          )}
        </div>
        {isExpanded && subfolders.map(subfolder => renderFolder(subfolder, level + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {/* Dashboard/Home button */}
      <div
        className={`flex items-center space-x-2 p-2 hover:bg-gray-100 cursor-pointer rounded ${
          currentFolderId === null ? 'bg-blue-100' : ''
        }`}
        onClick={() => onFolderSelect(null)}
      >
        <Home className="h-4 w-4 text-gray-500" />
        <span className="text-sm">Dashboard</span>
      </div>

      {/* Folder tree */}
      {rootFolders.map(folder => renderFolder(folder))}
    </div>
  );
}

