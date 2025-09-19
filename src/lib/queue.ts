interface QueueJob {
  id: string;
  type: 'zip';
  data: unknown;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  processedAt?: Date;
}

class InMemoryQueue {
  private jobs: Map<string, QueueJob> = new Map();
  private processing = false;

  addJob(id: string, type: 'zip', data: unknown): QueueJob {
    const job: QueueJob = {
      id,
      type,
      data,
      status: 'pending',
      createdAt: new Date()
    };
    
    this.jobs.set(id, job);
    this.processQueue();
    return job;
  }

  getJob(id: string): QueueJob | undefined {
    return this.jobs.get(id);
  }

  updateJobStatus(id: string, status: QueueJob['status'], processedAt?: Date) {
    const job = this.jobs.get(id);
    if (job) {
      job.status = status;
      if (processedAt) {
        job.processedAt = processedAt;
      }
      this.jobs.set(id, job);
    }
  }

  private async processQueue() {
    if (this.processing) return;
    
    this.processing = true;
    
    while (true) {
      const pendingJob = Array.from(this.jobs.values()).find(job => job.status === 'pending');
      
      if (!pendingJob) {
        break;
      }
      
      await this.processJob(pendingJob);
    }
    
    this.processing = false;
  }

  private async processJob(job: QueueJob) {
    this.updateJobStatus(job.id, 'processing');
    
    try {
      if (job.type === 'zip') {
        await this.processZipJob(job);
        this.updateJobStatus(job.id, 'completed', new Date());
      }
    } catch (error) {
      console.error('Job processing error:', error);
      this.updateJobStatus(job.id, 'failed', new Date());
    }
  }

  private async processZipJob(job: QueueJob) {
    const { processZipFiles } = await import('./zip');
    const data = job.data as { fileIds: string[]; userId: string };
    return processZipFiles(data.fileIds, data.userId, job.id);
  }
}

export const queue = new InMemoryQueue();