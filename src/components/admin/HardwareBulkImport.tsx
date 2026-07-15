import React, { useState, useRef } from 'react';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { DragDropUpload } from '@/components/upload/DragDropUpload';

type HardwareType = 'cameras' | 'lenses' | 'lights' | 'controllers';

interface ImportField {
  key: string;
  label: string;
  required: boolean;
  type?: 'number' | 'string';
}

const fieldConfigs: Record<HardwareType, ImportField[]> = {
  cameras: [
    { key: 'brand', label: '品牌', required: true },
    { key: 'model', label: '型号', required: true },
    { key: 'resolution', label: '分辨率', required: true },
    { key: 'frame_rate', label: '帧率', required: true, type: 'number' },
    { key: 'interface', label: '接口', required: true },
    { key: 'sensor_size', label: '传感器尺寸', required: true },
    { key: 'tags', label: '标签', required: false },
  ],
  lenses: [
    { key: 'brand', label: '品牌', required: true },
    { key: 'model', label: '型号', required: true },
    { key: 'focal_length', label: '焦距', required: true },
    { key: 'aperture', label: '光圈', required: true },
    { key: 'mount', label: '卡口', required: true },
    { key: 'max_sensor_size', label: '靶面尺寸', required: false },
    { key: 'tags', label: '标签', required: false },
  ],
  lights: [
    { key: 'brand', label: '品牌', required: true },
    { key: 'model', label: '型号', required: true },
    { key: 'type', label: '类型', required: true },
    { key: 'color', label: '颜色', required: true },
    { key: 'power', label: '功率', required: true },
    { key: 'tags', label: '标签', required: false },
  ],
  controllers: [
    { key: 'brand', label: '品牌', required: true },
    { key: 'model', label: '型号', required: true },
    { key: 'cpu', label: 'CPU', required: true },
    { key: 'gpu', label: 'GPU', required: false },
    { key: 'memory', label: '内存', required: true },
    { key: 'storage', label: '存储', required: true },
    { key: 'performance', label: '性能等级', required: true },
    { key: 'tags', label: '标签', required: false },
  ],
};

const typeLabels: Record<HardwareType, string> = {
  cameras: '相机',
  lenses: '镜头',
  lights: '光源',
  controllers: '工控机',
};

interface ParsedRow {
  data: Record<string, any>;
  errors: string[];
  valid: boolean;
}

interface HardwareBulkImportProps {
  type: HardwareType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (items: Record<string, any>[]) => Promise<void>;
}

export function HardwareBulkImport({ type, open, onOpenChange, onImport }: HardwareBulkImportProps) {
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const fields = fieldConfigs[type];

  const validateRow = (row: Record<string, any>): ParsedRow => {
    const errors: string[] = [];
    const data: Record<string, any> = { enabled: true };

    fields.forEach((field) => {
      let value = row[field.key] ?? row[field.label] ?? '';
      
      // Handle tags specially
      if (field.key === 'tags') {
        if (typeof value === 'string' && value.trim()) {
          data.tags = value.split(/[,，]/).map((t: string) => t.trim()).filter(Boolean);
        } else {
          data.tags = [];
        }
        return;
      }

      // Convert to string first
      value = String(value).trim();

      if (field.required && !value) {
        errors.push(`${field.label}不能为空`);
      }

      if (field.type === 'number') {
        const num = Number(value);
        if (value && isNaN(num)) {
          errors.push(`${field.label}必须是数字`);
        } else {
          data[field.key] = num || 0;
        }
      } else {
        data[field.key] = value;
      }
    });

    return {
      data,
      errors,
      valid: errors.length === 0,
    };
  };

  const parseFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    setFileName(file.name);

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const parsed = results.data.map((row: any) => validateRow(row));
          setParsedData(parsed);
        },
        error: () => {
          toast.error('CSV 文件解析失败');
        },
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          const parsed = jsonData.map((row: any) => validateRow(row));
          setParsedData(parsed);
        } catch {
          toast.error('Excel 文件解析失败');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error('不支持的文件格式，请使用 CSV 或 Excel 文件');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseFile(file);
    }
  };

  const downloadTemplate = () => {
    const headers = fields.map((f) => f.label);
    const exampleRow = fields.map((f) => {
      if (f.key === 'tags') return '标签1, 标签2';
      if (f.type === 'number') return '30';
      return `示例${f.label}`;
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, typeLabels[type]);
    XLSX.writeFile(wb, `${typeLabels[type]}导入模板.xlsx`);
  };

  const handleImport = async () => {
    const validItems = parsedData.filter((row) => row.valid).map((row) => row.data);
    
    if (validItems.length === 0) {
      toast.error('没有可导入的有效数据');
      return;
    }

    setImporting(true);
    try {
      await onImport(validItems);
      toast.success(`成功导入 ${validItems.length} 条${typeLabels[type]}数据`);
      onOpenChange(false);
      setParsedData([]);
      setFileName('');
    } catch (err) {
      toast.error('导入失败，请重试');
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsedData.filter((r) => r.valid).length;
  const invalidCount = parsedData.filter((r) => !r.valid).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>批量导入{typeLabels[type]}</DialogTitle>
          <DialogDescription>
            支持 Excel (.xlsx, .xls) 和 CSV 格式文件
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-hidden">
          {/* Upload Area */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label className="sr-only">选择文件</Label>
              <DragDropUpload
                accept=".csv,.xlsx,.xls"
                maxSize={20}
                showPreview={false}
                label={fileName || '拖拽 Excel / CSV 文件到此处'}
                hint="支持 .xlsx / .xls / .csv 格式"
                onUpload={async (files) => {
                  const file = files[0];
                  if (file) parseFile(file);
                }}
              />
            </div>
            <Button variant="outline" onClick={downloadTemplate} className="shrink-0">
              <Download className="h-4 w-4 mr-2" />
              下载模板
            </Button>
          </div>

          {/* Preview Table */}
          {parsedData.length > 0 && (
            <>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  共 {parsedData.length} 条数据
                </span>
                {validCount > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    {validCount} 条有效
                  </Badge>
                )}
                {invalidCount > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <AlertCircle className="h-3 w-3 text-destructive" />
                    {invalidCount} 条错误
                  </Badge>
                )}
              </div>

              <ScrollArea className="flex-1 border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">状态</TableHead>
                      {fields.slice(0, 4).map((field) => (
                        <TableHead key={field.key}>{field.label}</TableHead>
                      ))}
                      <TableHead>错误信息</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 100).map((row, index) => (
                      <TableRow key={index} className={!row.valid ? 'bg-destructive/5' : ''}>
                        <TableCell>
                          {row.valid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                        {fields.slice(0, 4).map((field) => (
                          <TableCell key={field.key} className="max-w-32 truncate">
                            {field.key === 'tags'
                              ? row.data.tags?.join(', ')
                              : row.data[field.key]}
                          </TableCell>
                        ))}
                        <TableCell className="text-destructive text-xs">
                          {row.errors.join('; ')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedData.length > 100 && (
                  <p className="text-center text-sm text-muted-foreground py-2">
                    仅显示前 100 条预览...
                  </p>
                )}
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleImport}
            disabled={validCount === 0 || importing}
          >
            {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            导入 {validCount} 条数据
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
