import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Camera, CircleDot, Lightbulb, Monitor, FileText, Cog, CloudUpload, Database } from 'lucide-react';
import { HardwareResourceManager } from '../admin/HardwareResourceManager';
import { PPTTemplateManager } from '../admin/PPTTemplateManager';
import { MechanismResourceManager } from '../admin/MechanismResourceManager';
import { HardwareImageMigration } from '../admin/HardwareImageMigration';
import { DataExportTool } from '../admin/DataExportTool';
import { StorageMigrationTool } from '../admin/StorageMigrationTool';

export function AdminCenter() {
  const [activeTab, setActiveTab] = useState('cameras');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <ScrollArea className="h-full">
        <div className="w-full max-w-6xl mx-auto p-6 pb-12">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">管理中心</h1>
          <p className="text-muted-foreground mt-1">
            维护硬件资源库、执行机构与PPT母版
          </p>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="grid w-full max-w-5xl grid-cols-8">
            <TabsTrigger value="cameras" className="gap-2">
              <Camera className="h-4 w-4" />
              相机
            </TabsTrigger>
            <TabsTrigger value="lenses" className="gap-2">
              <CircleDot className="h-4 w-4" />
              镜头
            </TabsTrigger>
            <TabsTrigger value="lights" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              光源
            </TabsTrigger>
            <TabsTrigger value="controllers" className="gap-2">
              <Monitor className="h-4 w-4" />
              工控机
            </TabsTrigger>
            <TabsTrigger value="mechanisms" className="gap-2">
              <Cog className="h-4 w-4" />
              执行机构
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="h-4 w-4" />
              PPT母版
            </TabsTrigger>
            <TabsTrigger value="image-migration" className="gap-2">
              <CloudUpload className="h-4 w-4" />
              图片迁移
            </TabsTrigger>
            <TabsTrigger value="data-migration" className="gap-2">
              <Database className="h-4 w-4" />
              数据迁移
            </TabsTrigger>
          </TabsList>
          
          <div className="mt-6">
            <TabsContent value="cameras">
              <HardwareResourceManager type="cameras" />
            </TabsContent>
            <TabsContent value="lenses">
              <HardwareResourceManager type="lenses" />
            </TabsContent>
            <TabsContent value="lights">
              <HardwareResourceManager type="lights" />
            </TabsContent>
            <TabsContent value="controllers">
              <HardwareResourceManager type="controllers" />
            </TabsContent>
            <TabsContent value="mechanisms">
              <MechanismResourceManager />
            </TabsContent>
            <TabsContent value="templates">
              <PPTTemplateManager />
            </TabsContent>
            <TabsContent value="image-migration">
              <HardwareImageMigration />
            </TabsContent>
            <TabsContent value="data-migration">
              <div className="space-y-6">
                <DataExportTool />
                <StorageMigrationTool />
              </div>
            </TabsContent>
          </div>
        </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
