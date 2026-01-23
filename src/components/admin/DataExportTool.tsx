import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Download, Database, FileText, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { 
  exportAllTables, 
  MIGRATABLE_TABLES,
  type TableExportResult 
} from '@/services/dataMigrationService';
import { toast } from 'sonner';

export function DataExportTool() {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTable, setCurrentTable] = useState('');
  const [results, setResults] = useState<TableExportResult[]>([]);
  const [exportedSQL, setExportedSQL] = useState('');
  const [totalRows, setTotalRows] = useState(0);

  const handleExport = async () => {
    setExporting(true);
    setProgress(0);
    setResults([]);
    setExportedSQL('');

    try {
      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90));
      }, 200);

      const { results: exportResults, combinedSQL, totalRows: rows } = await exportAllTables();

      clearInterval(progressInterval);
      setProgress(100);
      setResults(exportResults);
      setExportedSQL(combinedSQL);
      setTotalRows(rows);

      const successCount = exportResults.filter(r => !r.error).length;
      toast.success(`导出完成: ${successCount}/${exportResults.length} 个表, 共 ${rows} 条记录`);
    } catch (error) {
      toast.error('导出失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setExporting(false);
    }
  };

  const handleDownload = () => {
    if (!exportedSQL) return;

    const blob = new Blob([exportedSQL], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `data-export-${new Date().toISOString().split('T')[0]}.sql`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('SQL 文件已下载');
  };

  const handleCopy = async () => {
    if (!exportedSQL) return;

    try {
      await navigator.clipboard.writeText(exportedSQL);
      toast.success('已复制到剪贴板');
    } catch {
      toast.error('复制失败');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          数据库数据导出
        </CardTitle>
        <CardDescription>
          将所有表数据导出为 SQL INSERT 语句，用于迁移到本地 Supabase
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 表列表概览 */}
        <div>
          <h4 className="text-sm font-medium mb-2">将导出以下 {MIGRATABLE_TABLES.length} 个表:</h4>
          <div className="flex flex-wrap gap-2">
            {MIGRATABLE_TABLES.map(table => (
              <Badge key={table} variant="outline" className="text-xs">
                {table}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        {/* 导出按钮 */}
        <div className="flex items-center gap-4">
          <Button 
            onClick={handleExport} 
            disabled={exporting}
            className="gap-2"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <Database className="h-4 w-4" />
                导出全部数据
              </>
            )}
          </Button>

          {exportedSQL && (
            <>
              <Button variant="outline" onClick={handleDownload} className="gap-2">
                <Download className="h-4 w-4" />
                下载 SQL 文件
              </Button>
              <Button variant="ghost" onClick={handleCopy} className="gap-2">
                <FileText className="h-4 w-4" />
                复制到剪贴板
              </Button>
            </>
          )}
        </div>

        {/* 进度条 */}
        {exporting && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>正在导出: {currentTable || '准备中...'}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {/* 导出结果 */}
        {results.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">导出结果</h4>
              <Badge variant="secondary">
                共 {totalRows} 条记录
              </Badge>
            </div>

            <ScrollArea className="h-48 rounded-md border p-3">
              <div className="space-y-2">
                {results.map(result => (
                  <div 
                    key={result.tableName}
                    className="flex items-center justify-between py-1"
                  >
                    <div className="flex items-center gap-2">
                      {result.error ? (
                        <XCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      <span className="text-sm font-mono">{result.tableName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.error ? (
                        <span className="text-xs text-destructive">{result.error}</span>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          {result.rowCount} 行
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* SQL 预览 */}
        {exportedSQL && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">SQL 预览 (前 500 字符)</h4>
            <ScrollArea className="h-32 rounded-md border bg-muted p-3">
              <pre className="text-xs font-mono whitespace-pre-wrap">
                {exportedSQL.substring(0, 500)}...
              </pre>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
