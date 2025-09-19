'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { List, Grid } from 'lucide-react';
import { supabaseApi } from '@/lib/supabase-api';
import { FolderTree } from './FolderTree';
import { FileList } from './FileList';
import { RecentFiles } from './RecentFiles';
import { Breadcrumb } from './Breadcrumb';
import { MoveFileDialog } from './MoveFileDialog';

interface User {
  id: string;
  email: string;
}

interface FileManagerProps {
  user: User;
  onLogout: () => void;
}

export function FileManager({ user, onLogout }: FileManagerProps) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  
  const queryClient = useQueryClient();

  // Get current folder files
  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ['files', currentFolderId],
    queryFn: () => supabaseApi.getFiles(currentFolderId || undefined),
    enabled: currentFolderId !== null,
  });

  // Get subfolders in current folder (including root level when currentFolderId is null)
  const { data: subfolders = [], isLoading: subfoldersLoading } = useQuery({
    queryKey: ['subfolders', currentFolderId],
    queryFn: () => supabaseApi.getFolders(currentFolderId || undefined),
  });

  // Get recent files for dashboard
  const { data: recentFiles = [] } = useQuery({
    queryKey: ['files', 'recent'],
    queryFn: () => supabaseApi.getRecentFiles(),
  });

  // Get breadcrumbs for current folder
  const { data: breadcrumbs = [] } = useQuery({
    queryKey: ['breadcrumbs', currentFolderId],
    queryFn: () => currentFolderId ? supabaseApi.getFolderBreadcrumbs(currentFolderId) : [],
    enabled: !!currentFolderId,
  });

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: (name: string) => supabaseApi.createFolder(name, currentFolderId || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['subfolders'] });
      setNewFolderName('');
      setShowNewFolderDialog(false);
    },
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: (data: { file: File; folderId: string }) => 
      supabaseApi.uploadFile(data.file, data.folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['files', 'recent'] });
      setUploadFile(null);
      setShowUploadDialog(false);
    },
  });

  // Delete files mutation
  const deleteFilesMutation = useMutation({
    mutationFn: async (fileIds: string[]) => {
      for (const fileId of fileIds) {
        await supabaseApi.deleteFile(fileId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['files', 'recent'] });
      setSelectedFiles([]);
    },
  });

  // Download files mutation
  const downloadFilesMutation = useMutation({
    mutationFn: (fileIds: string[]) => supabaseApi.downloadFiles(fileIds),
    onSuccess: (blob) => {
      // Download the zip file
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `files_${Date.now()}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
  });

  // Move files mutation
  const moveFilesMutation = useMutation({
    mutationFn: async (data: { fileIds: string[]; targetFolderId: string }) => {
      const results = []
      for (const fileId of data.fileIds) {
        try {
          const result = await supabaseApi.moveFile(fileId, data.targetFolderId);
          results.push(result)
        } catch (error) {
          console.error(`Failed to move file ${fileId}:`, error)
          throw error
        }
      }
      return results
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['files', 'recent'] });
      setSelectedFiles([]);
    },
    onError: (error) => {
      console.error('Move files error:', error)
      alert('Failed to move some files. Please try again.')
    }
  });

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolderMutation.mutate(newFolderName.trim());
    }
  };

  const handleUploadFile = () => {
    if (uploadFile && currentFolderId) {
      uploadFileMutation.mutate({ file: uploadFile, folderId: currentFolderId });
    }
  };

  const handleDeleteSelected = () => {
    if (selectedFiles.length > 0) {
      if (confirm(`Delete ${selectedFiles.length} selected files?`)) {
        deleteFilesMutation.mutate(selectedFiles);
      }
    }
  };

  const handleDownloadSelected = () => {
    if (selectedFiles.length > 0) {
      downloadFilesMutation.mutate(selectedFiles);
    }
  };

  const handleSelectAll = () => {
    const allFileIds = files.map(file => file.id);
    setSelectedFiles(allFileIds);
  };

  const handleSelectNone = () => {
    setSelectedFiles([]);
  };

  const handleMoveFiles = (targetFolderId: string) => {
    if (selectedFiles.length > 0) {
      // Don't move to the same folder
      if (targetFolderId === currentFolderId) {
        alert('Cannot move files to the same folder they are already in.');
        return;
      }
      moveFilesMutation.mutate({ fileIds: selectedFiles, targetFolderId });
    }
  };

  const handleLogout = async () => {
    try {
      await supabaseApi.signOut();
      // Clear all React Query cache on logout
      queryClient.clear();
      onLogout();
    } catch (error) {
      console.error('Logout error:', error);
      // Clear cache even on error
      queryClient.clear();
      onLogout(); // Force logout even if there's an error
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold">File Manager</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{user.email}</span>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Folder Tree */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Folders</CardTitle>
              </CardHeader>
              <CardContent>
                <FolderTree
                  currentFolderId={currentFolderId}
                  onFolderSelect={setCurrentFolderId}
                />
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Dashboard - Recent Files and Root Folders */}
            {currentFolderId === null && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Files</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RecentFiles files={recentFiles as { id: string; name: string; size: number; created_at: string }[]} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Your Folders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FileList
                      files={[]}
                      folders={subfolders.map(folder => ({ ...folder, type: 'folder' as const }))}
                      loading={subfoldersLoading}
                      selectedFiles={[]}
                      onSelectionChange={() => {}}
                      onFolderClick={setCurrentFolderId}
                      viewMode={viewMode}
                    />
                  </CardContent>
                </Card>
              </>
            )}

            {/* File Management */}
            {currentFolderId && (
              <>
                {/* Breadcrumb Navigation */}
                <Breadcrumb
                  currentFolderId={currentFolderId}
                  breadcrumbs={breadcrumbs}
                  onNavigate={setCurrentFolderId}
                />

                {/* Actions */}
                <div className="flex flex-wrap gap-4">
                  <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
                    <DialogTrigger asChild>
                      <Button>New Folder</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Folder</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Input
                          placeholder="Folder name"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                        />
                        <Button 
                          onClick={handleCreateFolder}
                          disabled={createFolderMutation.isPending || !newFolderName.trim()}
                        >
                          {createFolderMutation.isPending ? 'Creating...' : 'Create'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                    <DialogTrigger asChild>
                      <Button>Upload File</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Upload PDF File</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Input
                          type="file"
                          accept=".pdf"
                          onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        />
                        <Button 
                          onClick={handleUploadFile}
                          disabled={uploadFileMutation.isPending || !uploadFile}
                        >
                          {uploadFileMutation.isPending ? 'Uploading...' : 'Upload'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {files.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAll}
                        disabled={selectedFiles.length === files.length}
                      >
                        Select All
                      </Button>
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={handleSelectNone}
                        disabled={selectedFiles.length === 0}
                      >
                        Select None
                      </Button>
                    </div>
                  )}

                  {selectedFiles.length > 0 && (
                    <>
                      <Button 
                        variant="destructive"
                        onClick={handleDeleteSelected}
                        disabled={deleteFilesMutation.isPending}
                      >
                        Delete Selected ({selectedFiles.length})
                      </Button>
                      <Button 
                        onClick={handleDownloadSelected}
                        disabled={downloadFilesMutation.isPending}
                      >
                        {downloadFilesMutation.isPending ? 'Creating ZIP...' : `Download Selected (${selectedFiles.length})`}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setShowMoveDialog(true)}
                        disabled={moveFilesMutation.isPending}
                      >
                        {moveFilesMutation.isPending ? 'Moving...' : `Move Selected (${selectedFiles.length})`}
                      </Button>
                    </>
                  )}
                </div>

                {/* File List */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Files</CardTitle>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant={viewMode === 'list' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setViewMode('list')}
                        >
                          <List className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={viewMode === 'grid' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setViewMode('grid')}
                        >
                          <Grid className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <FileList
                      files={files.map(file => ({ ...file, type: 'file' as const }))}
                      folders={subfolders.map(folder => ({ ...folder, type: 'folder' as const }))}
                      loading={filesLoading || subfoldersLoading}
                      selectedFiles={selectedFiles}
                      onSelectionChange={setSelectedFiles}
                      onFolderClick={setCurrentFolderId}
                      viewMode={viewMode}
                    />
                  </CardContent>
                </Card>
              </>
            )}

            {/* Move Files Dialog */}
            <MoveFileDialog
              open={showMoveDialog}
              onOpenChange={setShowMoveDialog}
              onMoveFiles={handleMoveFiles}
              selectedCount={selectedFiles.length}
            />
          </div>
        </div>
      </div>
    </div>
  );
}