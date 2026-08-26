export interface FileEntry {
  id: string
  name: string
  type?: string
  size?: number
  created_at?: string
  updated_at?: string
  folder_id?: string | null
  is_deleted?: boolean
  [k: string]: unknown
}
