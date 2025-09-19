import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { DatabaseOps } from './database';

const zipsDir = path.join(process.cwd(), 'zips');

// Ensure zips directory exists
if (!fs.existsSync(zipsDir)) {
  fs.mkdirSync(zipsDir, { recursive: true });
}

export async function processZipFiles(fileIds: string[], userId: string, jobId: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const zipPath = path.join(zipsDir, `${jobId}.zip`);
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        // Update job with download URL
        const downloadUrl = `/api/zip/${jobId}`;
        DatabaseOps.updateZipJobStatus(jobId, 'completed', downloadUrl);
        resolve(downloadUrl);
      });

      archive.on('error', (err) => {
        DatabaseOps.updateZipJobStatus(jobId, 'failed');
        reject(err);
      });

      archive.pipe(output);

      // Add files to archive
      for (const fileId of fileIds) {
        const file = await DatabaseOps.getFileById(fileId);
        if (file && file.user_id === userId && fs.existsSync(file.path)) {
          archive.file(file.path, { name: file.name });
        }
      }

      await archive.finalize();
    } catch (error) {
      DatabaseOps.updateZipJobStatus(jobId, 'failed');
      reject(error);
    }
  });
}