export interface SavedConnection {
  id: string
  name: string
  host: string
  port: number
  database: string
  username: string
  ssl: boolean
  color: string
  createdAt: number
}

export interface ConnectionConfig {
  id?: string
  name: string
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl: boolean
  color?: string
}

export interface QueryResult {
  rows: Record<string, unknown>[]
  fields: { name: string; dataTypeID: number }[]
  rowCount: number
  durationMs: number
  command: string
}

export interface TableData {
  rows: Record<string, unknown>[]
  fields: { name: string; dataTypeID: number }[]
  total: number
  limit: number
  offset: number
}

export interface TableInfo {
  schema: string
  name: string
  type: 'TABLE' | 'VIEW' | 'MATERIALIZED VIEW'
}

export interface ForeignKeyRef {
  schema: string
  table: string
  column: string
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  default: string | null
  isPrimary: boolean
  foreignKeys?: ForeignKeyRef[]
}

export interface QueryHistoryEntry {
  id: string
  connectionId: string
  sql: string
  executedAt: number
  durationMs?: number
  rowCount?: number
}

export interface SavedQuery {
  id: string
  name: string
  sql: string
  connectionId: string | null
  createdAt: number
  updatedAt: number
}
