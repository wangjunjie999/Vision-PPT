import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  HardDrive, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  FileText,
  Copy
} from 'lucide-react';
import { 
  getAllStorageStats, 
  generateStorageManifest,
  generateUserIdReplacementSQL,
  generateStorageUrlReplacementSQL,
  formatBytes,
  type StorageBucketStats 
} from '@/services/dataMigrationService';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export function StorageMigrationTool() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<StorageBucketStats[]>([]);
  const [manifest, setManifest] = useState('');

  // 本地配置
  const [localUrl, setLocalUrl] = useState('http://127.0.0.1:54321');
  const [newUserId, setNewUserId] = useState('');

  // 计算统计
  const totalFiles = stats.reduce((sum, s) => sum + s.fileCount, 0);
  const totalSize = stats.reduce((sum, s) => sum + s.totalSize, 0);

  const loadStats = async () => {
    setLoading(true);
    try {
      const storageStats = await getAllStorageStats();
      setStats(storageStats);
      setManifest(generateStorageManifest(storageStats));
      toast.success('已加载 Storage 统计');
    } catch (error) {
      toast.error('加载失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleDownloadManifest = () => {
    if (!manifest) return;

    const blob = new Blob([manifest], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `storage-manifest-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('文件清单已下载');
  };

  const handleGenerateUserIdSQL = () => {
    if (!user?.id || !newUserId) {
      toast.error('请输入新的 user_id');
      return;
    }

    const sql = generateUserIdReplacementSQL(user.id, newUserId);
    
    const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'replace-user-id.sql';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('user_id 替换脚本已下载');
  };

  const handleGenerateUrlSQL = () => {
    const cloudUrl = 'https://yxjhungswhwahnbhahaq.supabase.co/storage/v1/object/public';
    const localStorageUrl = `${localUrl}/storage/v1/object/public`;
    
    const sql = generateStorageUrlReplacementSQL(cloudUrl, localStorageUrl);
    
    const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'replace-storage-urls.sql';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Storage URL 替换脚本已下载');
  };

  const handleCopyFileUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('URL 已复制');
    } catch {
      toast.error('复制失败');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          Storage 文件迁移
        </CardTitle>
        <CardDescription>
          查看云端 Storage 文件并生成迁移所需的脚本和清单
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 统计概览 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {totalFiles}
              </Badge>
              <span className="text-sm text-muted-foreground">个文件</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-lg px-3 py-1">
                {formatBytes(totalSize)}
              </Badge>
              <span className="text-sm text-muted-foreground">总大小</span>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadStats}
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            刷新
          </Button>
        </div>

        <Separator />

        <Tabs defaultValue="buckets" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="buckets">存储桶统计</TabsTrigger>
            <TabsTrigger value="scripts">迁移脚本</TabsTrigger>
            <TabsTrigger value="manifest">文件清单</TabsTrigger>
          </TabsList>

          {/* 存储桶统计 */}
          <TabsContent value="buckets" className="space-y-4">
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {stats.map(stat => (
                  <div 
                    key={stat.bucket}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      {stat.fileCount > 0 ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">{stat.bucket}</p>
                        <p className="text-xs text-muted-foreground">
                          {stat.fileCount} 个文件
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {formatBytes(stat.totalSize)}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <Button 
              onClick={handleDownloadManifest}
              disabled={!manifest}
              className="w-full gap-2"
            >
              <Download className="h-4 w-4" />
              下载文件清单 (Markdown)
            </Button>
          </TabsContent>

          {/* 迁移脚本生成 */}
          <TabsContent value="scripts" className="space-y-4">
            {/* user_id 替换 */}
            <div className="space-y-3 p-4 rounded-lg border">
              <h4 className="font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                user_id 替换脚本
              </h4>
              <p className="text-sm text-muted-foreground">
                在本地 Supabase 注册后，使用新的 user_id 替换数据库中的旧 ID
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">当前 user_id (云端)</Label>
                  <Input 
                    value={user?.id || ''} 
                    readOnly 
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">新 user_id (本地)</Label>
                  <Input 
                    placeholder="从本地 Studio 获取"
                    value={newUserId}
                    onChange={e => setNewUserId(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <Button 
                onClick={handleGenerateUserIdSQL}
                disabled={!newUserId}
                variant="outline"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                生成替换脚本
              </Button>
            </div>

            {/* Storage URL 替换 */}
            <div className="space-y-3 p-4 rounded-lg border">
              <h4 className="font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Storage URL 替换脚本
              </h4>
              <p className="text-sm text-muted-foreground">
                将数据库中的云端 Storage URL 替换为本地 URL
              </p>
              <div className="space-y-2">
                <Label className="text-xs">本地 Supabase URL</Label>
                <Input 
                  value={localUrl}
                  onChange={e => setLocalUrl(e.target.value)}
                  placeholder="http://127.0.0.1:54321"
                  className="font-mono text-xs"
                />
              </div>
              <Button 
                onClick={handleGenerateUrlSQL}
                variant="outline"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                生成 URL 替换脚本
              </Button>
            </div>
          </TabsContent>

          {/* 文件清单 */}
          <TabsContent value="manifest" className="space-y-4">
            <ScrollArea className="h-64 rounded-md border bg-muted p-3">
              {stats.flatMap(stat => 
                stat.files.map(file => (
                  <div 
                    key={`${stat.bucket}-${file.name}`}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {stat.bucket} · {formatBytes(file.size)}
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleCopyFileUrl(file.url)}
                      className="gap-1"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
              {totalFiles === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  暂无文件
                </p>
              )}
            </ScrollArea>

            <div className="text-xs text-muted-foreground">
              <p>📋 迁移步骤:</p>
              <ol className="list-decimal ml-4 space-y-1 mt-1">
                <li>复制每个文件的 URL</li>
                <li>使用浏览器或 wget/curl 下载文件</li>
                <li>在本地 Studio 中上传到对应存储桶</li>
                <li>执行 URL 替换脚本更新数据库引用</li>
              </ol>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
