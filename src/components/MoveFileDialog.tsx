'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabaseApi, type Folder } from '@/lib/supabase-api';
import { ChevronRight, ChevronDown, Folder as FolderIcon } from 'lucide-react';

interface MoveFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoveFiles: (targetFolderId: string) => void;
  selectedCount: number;
}

export function MoveFileDialog({ 
  open, 
  onOpenChange, 
  onMoveFiles, 
  selectedCount 
}: MoveFileDialogProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedTargetFolder, setSelectedTargetFolder] = useState<string>('');

  // Get root folders
  const { data: rootFolders = [] } = useQuery({
    queryKey: ['folders', null],
    queryFn: () => supabaseApi.getFolders(),
    enabled: open,
  });

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
    enabled: expandedFolders.size > 0 && open,
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

  const handleMoveFiles = () => {
    if (selectedTargetFolder) {
      onMoveFiles(selectedTargetFolder);
      onOpenChange(false);
      setSelectedTargetFolder('');
      setExpandedFolders(new Set());
    }
  };

  const renderFolder = (folder: Folder, level = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedTargetFolder === folder.id;
    const subfolders = subfolderResults.data?.[folder.id] || [];

    return (
      <div key={folder.id}>
        <div
          className={`flex items-center space-x-2 p-2 hover:bg-gray-100 cursor-pointer rounded ${
            isSelected ? 'bg-blue-100 border border-blue-300' : ''
          }`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
          onClick={() => setSelectedTargetFolder(folder.id)}
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
        </div>
        {isExpanded && subfolders.map(subfolder => renderFolder(subfolder, level + 1))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Move {selectedCount} file{selectedCount !== 1 ? 's' : ''} to folder
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="max-h-64 overflow-y-auto border rounded p-2">
            <div className="space-y-1">
              {rootFolders.map(folder => renderFolder(folder))}
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleMoveFiles}
              disabled={!selectedTargetFolder}
            >
              Move Files
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}