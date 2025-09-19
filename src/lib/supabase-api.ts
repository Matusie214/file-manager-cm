import { supabase } from './supabase'
import { v4 as uuidv4 } from 'uuid'

export interface Folder {
  id: string
  name: string
  parent_id: string | null
  user_id: string
  path: string
  created_at: string
}

export interface File {
  id: string
  name: string
  size: number
  checksum: string
  folder_id: string
  user_id: string
  storage_path: string
  mime_type: string
  created_at: string
  updated_at: string
}

export const supabaseApi = {
  // Auth
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    if (error) throw error
    return data
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  async getUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    return user
  },

  // Folders
  async getFolders(parentId?: string, limit = 50, offset = 0): Promise<Folder[]> {
    let query = supabase
      .from('fm_folders')
      .select('*')
      .order('name')
      .range(offset, offset + limit - 1)

    if (parentId) {
      query = query.eq('parent_id', parentId)
    } else {
      query = query.is('parent_id', null)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async createFolder(name: string, parentId?: string): Promise<Folder> {
    const user = await this.getUser()
    if (!user) throw new Error('User not authenticated')

    // Build path for materialized path pattern
    let path = '/'
    if (parentId) {
      const { data: parentFolder, error: parentError } = await supabase
        .from('fm_folders')
        .select('path, name')
        .eq('id', parentId)
        .single()
      
      if (parentError) throw parentError
      path = `${parentFolder.path}${parentFolder.name}/`
    }

    const { data, error } = await supabase
      .from('fm_folders')
      .insert({
        name,
        parent_id: parentId || null,
        user_id: user.id,
        path,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteFolder(id: string): Promise<void> {
    const { error } = await supabase
      .from('fm_folders')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // Files
  async getFiles(folderId?: string, limit = 50, offset = 0): Promise<File[]> {
    let query = supabase
      .from('fm_files')
      .select('*')
      .order('name')
      .range(offset, offset + limit - 1)

    if (folderId) {
      query = query.eq('folder_id', folderId)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async getRecentFiles(limit = 20): Promise<File[]> {
    const { data, error } = await supabase
      .from('fm_files')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },

  async uploadFile(file: globalThis.File, folderId: string): Promise<File> {
    const user = await this.getUser()
    if (!user) throw new Error('User not authenticated')

    // Generate file ID and storage path
    const fileId = uuidv4()
    const storagePath = `${user.id}/${fileId}_${file.name}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('files')
      .upload(storagePath, file)

    if (uploadError) throw uploadError

    // Calculate checksum (simplified - in production use actual file hash)
    const checksum = `${file.size}_${file.name}_${Date.now()}`

    // Save file metadata to database
    const { data, error } = await supabase
      .from('fm_files')
      .insert({
        id: fileId,
        name: file.name,
        size: file.size,
        checksum,
        folder_id: folderId,
        user_id: user.id,
        storage_path: storagePath,
        mime_type: file.type,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteFile(id: string): Promise<void> {
    // Get file info first
    const { data: file, error: fetchError } = await supabase
      .from('fm_files')
      .select('storage_path')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('files')
      .remove([file.storage_path])

    if (storageError) console.warn('Storage delete error:', storageError)

    // Delete from database
    const { error } = await supabase
      .from('fm_files')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async moveFile(fileId: string, newFolderId: string): Promise<File> {
    console.log(`Moving file ${fileId} to folder ${newFolderId}`)
    
    // First get the current file data
    const { data: currentFile, error: fetchError } = await supabase
      .from('fm_files')
      .select('*')
      .eq('id', fileId)
      .single()

    if (fetchError) {
      console.error('Fetch file error:', fetchError)
      throw fetchError
    }

    // Use upsert instead of update to avoid CORS issues
    const { data, error } = await supabase
      .from('fm_files')
      .upsert({
        ...currentFile,
        folder_id: newFolderId,
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single()

    if (error) {
      console.error('Move file error:', {
        error,
        fileId,
        newFolderId,
        code: error.code,
        message: error.message,
        details: error.details
      })
      throw error
    }
    
    console.log('File moved successfully:', data)
    return data
  },

  async getFolderParents(folderId: string): Promise<string[]> {
    const parents: string[] = [];
    let currentId = folderId;

    while (currentId) {
      const { data: folder, error } = await supabase
        .from('fm_folders')
        .select('parent_id')
        .eq('id', currentId)
        .single();

      if (error || !folder) break;

      if (folder.parent_id) {
        parents.unshift(folder.parent_id); // Add to beginning to get correct order
        currentId = folder.parent_id;
      } else {
        break;
      }
    }

    return parents;
  },

  async getFolderBreadcrumbs(folderId: string): Promise<{ id: string; name: string; path: string }[]> {
    const { data: folder, error } = await supabase
      .from('fm_folders')
      .select('path, name')
      .eq('id', folderId)
      .single()

    if (error) throw error

    // Parse path to get all parent folders
    const pathParts = folder.path.split('/').filter((part: string) => part)
    const breadcrumbs: { id: string; name: string; path: string }[] = []

    // Get all folders in the path
    if (pathParts.length > 0) {
      const { data: pathFolders, error: pathError } = await supabase
        .from('fm_folders')
        .select('id, name, path')
        .in('name', pathParts)
        .order('path')

      if (pathError) throw pathError

      // Build breadcrumbs from path
      pathFolders?.forEach(pathFolder => {
        breadcrumbs.push({
          id: pathFolder.id,
          name: pathFolder.name,
          path: pathFolder.path
        })
      })
    }

    // Add current folder
    breadcrumbs.push({
      id: folderId,
      name: folder.name,
      path: folder.path
    })

    return breadcrumbs
  },

  // Storage URLs
  getFileUrl(storagePath: string): string {
    const { data } = supabase.storage
      .from('files')
      .getPublicUrl(storagePath)
    
    return data.publicUrl
  },

  async downloadFiles(fileIds: string[]): Promise<Blob> {
    // For demo purposes, we'll create a simple zip using JSZip
    // In production, you'd want server-side zip generation
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()

    for (const fileId of fileIds) {
      const { data: file, error } = await supabase
        .from('fm_files')
        .select('name, storage_path')
        .eq('id', fileId)
        .single()

      if (error) continue

      // Download file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('files')
        .download(file.storage_path)

      if (downloadError) continue

      zip.file(file.name, fileData)
    }

    return await zip.generateAsync({ type: 'blob' })
  }
}