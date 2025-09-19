import sqlite3 from 'sqlite3';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new sqlite3.Database(dbPath);

export interface User {
  id: string;
  email: string;
  password: string;
  created_at: string;
}

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  user_id: string;
  path: string;
  created_at: string;
}

export interface File {
  id: string;
  name: string;
  size: number;
  checksum: string;
  folder_id: string;
  user_id: string;
  path: string;
  mime_type: string;
  created_at: string;
  updated_at: string;
}

export interface ZipJob {
  id: string;
  user_id: string;
  file_ids: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  download_url?: string;
  created_at: string;
  completed_at?: string;
}

export function initializeDatabase(): Promise<void> {
  return new Promise((resolve) => {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Folders table - uses materialized path for efficient deep nesting
      db.run(`
        CREATE TABLE IF NOT EXISTS folders (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          parent_id TEXT,
          user_id TEXT NOT NULL,
          path TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Files table
      db.run(`
        CREATE TABLE IF NOT EXISTS files (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          size INTEGER NOT NULL,
          checksum TEXT NOT NULL,
          folder_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          path TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Zip jobs table
      db.run(`
        CREATE TABLE IF NOT EXISTS zip_jobs (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          file_ids TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          download_url TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Indexes for performance
      db.run('CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_folders_path ON folders(path)');
      db.run('CREATE INDEX IF NOT EXISTS idx_files_folder_id ON files(folder_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_files_checksum ON files(checksum)');
      db.run('CREATE INDEX IF NOT EXISTS idx_zip_jobs_user_id ON zip_jobs(user_id)');

      resolve();
    });
  });
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function calculateFileChecksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Database operation functions
export const DatabaseOps = {
  // Users
  createUser: (user: Omit<User, 'created_at'>): Promise<User> => {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare('INSERT INTO users (id, email, password) VALUES (?, ?, ?)');
      stmt.run([user.id, user.email, user.password], function(err) {
        if (err) reject(err);
        else {
          DatabaseOps.getUserById(user.id).then((result) => {
            if (result) resolve(result);
            else reject(new Error('Failed to create user'));
          }).catch(reject);
        }
      });
    });
  },

  getUserByEmail: (email: string): Promise<User | null> => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        else resolve(row as User || null);
      });
    });
  },

  getUserById: (id: string): Promise<User | null> => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row as User || null);
      });
    });
  },

  // Folders
  createFolder: (folder: Omit<Folder, 'created_at'>): Promise<Folder> => {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare('INSERT INTO folders (id, name, parent_id, user_id, path) VALUES (?, ?, ?, ?, ?)');
      stmt.run([folder.id, folder.name, folder.parent_id, folder.user_id, folder.path], function(err) {
        if (err) reject(err);
        else {
          DatabaseOps.getFolderById(folder.id).then((result) => {
            if (result) resolve(result);
            else reject(new Error('Failed to create folder'));
          }).catch(reject);
        }
      });
    });
  },

  getFolderById: (id: string): Promise<Folder | null> => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM folders WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row as Folder || null);
      });
    });
  },

  getFoldersByUserId: (userId: string, parentId: string | null = null, limit = 50, offset = 0): Promise<Folder[]> => {
    return new Promise((resolve, reject) => {
      const query = parentId 
        ? 'SELECT * FROM folders WHERE user_id = ? AND parent_id = ? ORDER BY name LIMIT ? OFFSET ?'
        : 'SELECT * FROM folders WHERE user_id = ? AND parent_id IS NULL ORDER BY name LIMIT ? OFFSET ?';
      
      const params = parentId ? [userId, parentId, limit, offset] : [userId, limit, offset];
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as Folder[]);
      });
    });
  },

  deleteFolder: (id: string, userId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM folders WHERE id = ? AND user_id = ?', [id, userId], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  // Files
  createFile: (file: Omit<File, 'created_at' | 'updated_at'>): Promise<File> => {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare('INSERT INTO files (id, name, size, checksum, folder_id, user_id, path, mime_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      stmt.run([file.id, file.name, file.size, file.checksum, file.folder_id, file.user_id, file.path, file.mime_type], function(err) {
        if (err) reject(err);
        else {
          DatabaseOps.getFileById(file.id).then((result) => {
            if (result) resolve(result);
            else reject(new Error('Failed to create file'));
          }).catch(reject);
        }
      });
    });
  },

  getFileById: (id: string): Promise<File | null> => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM files WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row as File || null);
      });
    });
  },

  getFilesByFolderId: (folderId: string, userId: string, limit = 50, offset = 0): Promise<File[]> => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM files WHERE folder_id = ? AND user_id = ? ORDER BY name LIMIT ? OFFSET ?', 
        [folderId, userId, limit, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows as File[]);
      });
    });
  },

  getRecentFiles: (userId: string, limit = 20): Promise<File[]> => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM files WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', 
        [userId, limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows as File[]);
      });
    });
  },

  deleteFile: (id: string, userId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM files WHERE id = ? AND user_id = ?', [id, userId], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  moveFile: (fileId: string, newFolderId: string, userId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      db.run('UPDATE files SET folder_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', 
        [newFolderId, fileId, userId], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  // Zip jobs
  createZipJob: (job: Omit<ZipJob, 'created_at' | 'completed_at'>): Promise<ZipJob> => {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare('INSERT INTO zip_jobs (id, user_id, file_ids, status, download_url) VALUES (?, ?, ?, ?, ?)');
      stmt.run([job.id, job.user_id, job.file_ids, job.status, job.download_url], function(err) {
        if (err) reject(err);
        else {
          DatabaseOps.getZipJobById(job.id).then((result) => {
            if (result) resolve(result);
            else reject(new Error('Failed to create zip job'));
          }).catch(reject);
        }
      });
    });
  },

  getZipJobById: (id: string): Promise<ZipJob | null> => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM zip_jobs WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row as ZipJob || null);
      });
    });
  },

  updateZipJobStatus: (id: string, status: ZipJob['status'], downloadUrl?: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const query = downloadUrl 
        ? 'UPDATE zip_jobs SET status = ?, download_url = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?'
        : 'UPDATE zip_jobs SET status = ? WHERE id = ?';
      const params = downloadUrl ? [status, downloadUrl, id] : [status, id];
      
      db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

export default db;