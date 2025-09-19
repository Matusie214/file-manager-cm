import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xyzcompany.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emNvbXBhbnkiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0MDk5NTIwMCwiZXhwIjoxOTU2NTcxMjAwfQ.fake-key-for-build'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Database {
  public: {
    Tables: {
      fm_folders: {
        Row: {
          id: string
          name: string
          parent_id: string | null
          user_id: string
          path: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          parent_id?: string | null
          user_id: string
          path: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          parent_id?: string | null
          user_id?: string
          path?: string
          created_at?: string
        }
      }
      fm_files: {
        Row: {
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
        Insert: {
          id?: string
          name: string
          size: number
          checksum: string
          folder_id: string
          user_id: string
          storage_path: string
          mime_type: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          size?: number
          checksum?: string
          folder_id?: string
          user_id?: string
          storage_path?: string
          mime_type?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}