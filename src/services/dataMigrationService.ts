import { supabase } from "@/integrations/supabase/client";

// 支持迁移的表列表
export const MIGRATABLE_TABLES = [
  'projects',
  'workstations', 
  'mechanical_layouts',
  'function_modules',
  'ppt_templates',
  'product_assets',
  'product_annotations',
  'asset_registry',
  'cameras',
  'lenses',
  'lights',
  'controllers',
  'mechanisms',
  'user_roles'
] as const;

export type MigratableTable = typeof MIGRATABLE_TABLES[number];

// Storage 存储桶列表
export const STORAGE_BUCKETS = [
  'workstation-views',
  'module-schematics',
  'ppt-templates',
  'project-assets',
  'product-models',
  'product-snapshots',
  'hardware-images'
] as const;

export type StorageBucket = typeof STORAGE_BUCKETS[number];

export interface TableExportResult {
  tableName: string;
  rowCount: number;
  sql: string;
  error?: string;
}

export interface StorageFileInfo {
  bucket: string;
  name: string;
  size: number;
  url: string;
  createdAt: string;
}

export interface StorageBucketStats {
  bucket: string;
  fileCount: number;
  totalSize: number;
  files: StorageFileInfo[];
}

// SQL 值格式化
function formatSQLValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'object') {
    // JSON 对象或数组
    const jsonStr = JSON.stringify(value).replace(/'/g, "''");
    return `'${jsonStr}'::jsonb`;
  }
  // 字符串 - 转义单引号
  const escaped = String(value).replace(/'/g, "''");
  return `'${escaped}'`;
}

// 导出单个表为 SQL INSERT 语句
export async function exportTableAsSQL(tableName: MigratableTable): Promise<TableExportResult> {
  try {
    // 使用类型断言处理动态表名
    const { data, error } = await supabase
      .from(tableName)
      .select('*');

    if (error) {
      return {
        tableName,
        rowCount: 0,
        sql: '',
        error: error.message
      };
    }

    if (!data || data.length === 0) {
      return {
        tableName,
        rowCount: 0,
        sql: `-- ${tableName}: 无数据\n`
      };
    }

    const columns = Object.keys(data[0]);
    const columnList = columns.join(', ');

    const insertStatements = data.map(row => {
      const values = columns.map(col => formatSQLValue(row[col])).join(', ');
      return `INSERT INTO public.${tableName} (${columnList}) VALUES (${values});`;
    });

    const sql = `-- ${tableName}: ${data.length} 条记录\n${insertStatements.join('\n')}\n`;

    return {
      tableName,
      rowCount: data.length,
      sql
    };
  } catch (err) {
    return {
      tableName,
      rowCount: 0,
      sql: '',
      error: err instanceof Error ? err.message : '未知错误'
    };
  }
}

// 导出所有表
export async function exportAllTables(): Promise<{
  results: TableExportResult[];
  combinedSQL: string;
  totalRows: number;
}> {
  const results: TableExportResult[] = [];
  let combinedSQL = `-- ================================================\n`;
  combinedSQL += `-- 数据导出时间: ${new Date().toISOString()}\n`;
  combinedSQL += `-- 请先执行 migration-schema.sql 创建表结构\n`;
  combinedSQL += `-- ================================================\n\n`;
  
  let totalRows = 0;

  // 按依赖顺序导出（先导出被引用的表）
  const orderedTables: MigratableTable[] = [
    'cameras',
    'lenses', 
    'lights',
    'controllers',
    'mechanisms',
    'projects',
    'workstations',
    'mechanical_layouts',
    'function_modules',
    'ppt_templates',
    'product_assets',
    'product_annotations',
    'asset_registry',
    'user_roles'
  ];

  for (const tableName of orderedTables) {
    const result = await exportTableAsSQL(tableName);
    results.push(result);
    combinedSQL += result.sql + '\n';
    totalRows += result.rowCount;
  }

  return { results, combinedSQL, totalRows };
}

// 获取 Storage 存储桶统计
export async function getStorageBucketStats(bucket: StorageBucket): Promise<StorageBucketStats> {
  try {
    const { data, error } = await supabase.storage.from(bucket).list('', {
      limit: 1000,
      sortBy: { column: 'created_at', order: 'desc' }
    });

    if (error) {
      console.error(`获取 ${bucket} 文件列表失败:`, error);
      return { bucket, fileCount: 0, totalSize: 0, files: [] };
    }

    const files: StorageFileInfo[] = (data || [])
      .filter(item => item.name && !item.name.endsWith('/'))
      .map(item => {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(item.name);
        return {
          bucket,
          name: item.name,
          size: item.metadata?.size || 0,
          url: urlData.publicUrl,
          createdAt: item.created_at || ''
        };
      });

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    return {
      bucket,
      fileCount: files.length,
      totalSize,
      files
    };
  } catch (err) {
    console.error(`获取 ${bucket} 统计失败:`, err);
    return { bucket, fileCount: 0, totalSize: 0, files: [] };
  }
}

// 获取所有 Storage 统计
export async function getAllStorageStats(): Promise<StorageBucketStats[]> {
  const stats = await Promise.all(
    STORAGE_BUCKETS.map(bucket => getStorageBucketStats(bucket))
  );
  return stats;
}

// 生成 Storage 文件清单
export function generateStorageManifest(stats: StorageBucketStats[]): string {
  let manifest = `# Storage 文件清单\n`;
  manifest += `生成时间: ${new Date().toISOString()}\n\n`;

  let totalFiles = 0;
  let totalSize = 0;

  for (const stat of stats) {
    manifest += `## ${stat.bucket}\n`;
    manifest += `文件数: ${stat.fileCount}\n`;
    manifest += `总大小: ${formatBytes(stat.totalSize)}\n\n`;

    for (const file of stat.files) {
      manifest += `- ${file.name} (${formatBytes(file.size)})\n`;
      manifest += `  URL: ${file.url}\n`;
    }
    manifest += '\n';

    totalFiles += stat.fileCount;
    totalSize += stat.totalSize;
  }

  manifest += `---\n`;
  manifest += `总计: ${totalFiles} 个文件, ${formatBytes(totalSize)}\n`;

  return manifest;
}

// 生成 user_id 替换脚本
export function generateUserIdReplacementSQL(oldUserId: string, newUserId: string): string {
  const tables = [
    'projects',
    'workstations',
    'function_modules',
    'mechanical_layouts',
    'ppt_templates',
    'product_assets',
    'product_annotations',
    'asset_registry'
  ];

  let sql = `-- ================================================\n`;
  sql += `-- user_id 替换脚本\n`;
  sql += `-- 旧 user_id: ${oldUserId}\n`;
  sql += `-- 新 user_id: ${newUserId}\n`;
  sql += `-- ================================================\n\n`;
  sql += `DO $$\n`;
  sql += `DECLARE\n`;
  sql += `  old_user_id uuid := '${oldUserId}';\n`;
  sql += `  new_user_id uuid := '${newUserId}';\n`;
  sql += `BEGIN\n`;

  for (const table of tables) {
    sql += `  UPDATE public.${table} SET user_id = new_user_id WHERE user_id = old_user_id;\n`;
  }

  sql += `END $$;\n`;

  return sql;
}

// 生成 Storage URL 替换脚本
export function generateStorageUrlReplacementSQL(
  oldBaseUrl: string,
  newBaseUrl: string
): string {
  let sql = `-- ================================================\n`;
  sql += `-- Storage URL 替换脚本\n`;
  sql += `-- 旧 URL 前缀: ${oldBaseUrl}\n`;
  sql += `-- 新 URL 前缀: ${newBaseUrl}\n`;
  sql += `-- ================================================\n\n`;

  // 更新包含 URL 的表字段
  const urlFields = [
    { table: 'mechanical_layouts', columns: ['top_view_image_url', 'front_view_image_url', 'side_view_image_url'] },
    { table: 'function_modules', columns: ['schematic_image_url'] },
    { table: 'ppt_templates', columns: ['file_url', 'background_image_url'] },
    { table: 'cameras', columns: ['image_url'] },
    { table: 'lenses', columns: ['image_url'] },
    { table: 'lights', columns: ['image_url'] },
    { table: 'controllers', columns: ['image_url'] },
    { table: 'mechanisms', columns: ['top_view_image_url', 'front_view_image_url', 'side_view_image_url'] },
    { table: 'asset_registry', columns: ['file_url'] }
  ];

  for (const { table, columns } of urlFields) {
    for (const column of columns) {
      sql += `UPDATE public.${table}\n`;
      sql += `SET ${column} = REPLACE(${column}, '${oldBaseUrl}', '${newBaseUrl}')\n`;
      sql += `WHERE ${column} LIKE '${oldBaseUrl}%';\n\n`;
    }
  }

  return sql;
}

// 格式化字节数
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export { formatBytes };
