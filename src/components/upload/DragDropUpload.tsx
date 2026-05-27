/**
 * Drag & Drop Upload Component
 * Supports drag-and-drop file upload with rich visual feedback.
 * Variants: default | compact | thumbnail
 */
import { useState, useRef, useCallback, type ReactNode } from 'react';
import { Upload, FileImage, File as FileIcon, X, CheckCircle2, Loader2, ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type DragDropVariant = 'default' | 'compact' | 'thumbnail';

export interface DragDropUploadProps {
  onUpload: (files: File[]) => Promise<void> | void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in MB
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
  showPreview?: boolean;
  /** Visual style. `compact` = small button, `thumbnail` = tile (e.g. for image slot), `default` = full dropzone */
  variant?: DragDropVariant;
  /** @deprecated use variant="compact" */
  compact?: boolean;
  /** Existing image URL (for thumbnail variant) */
  currentUrl?: string | null;
  /** Called when remove button is clicked on thumbnail */
  onRemove?: () => void;
  /** Loading state from parent (for thumbnail variant) */
  uploading?: boolean;
  /** Short label for dropzone (e.g. "正视图") */
  label?: string;
  /** Helper text under main label */
  hint?: string;
  /** Icon to show when empty (thumbnail variant) */
  emptyIcon?: ReactNode;
}

interface FilePreview {
  file: File;
  preview: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DragDropUpload({
  onUpload,
  accept = 'image/*',
  multiple = false,
  maxSize = 10,
  maxFiles = 5,
  disabled = false,
  className,
  children,
  showPreview = true,
  variant,
  compact = false,
  currentUrl,
  onRemove,
  uploading: externalUploading,
  label,
  hint,
  emptyIcon,
}: DragDropUploadProps) {
  const resolvedVariant: DragDropVariant = variant ?? (compact ? 'compact' : 'default');
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [internalUploading, setInternalUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCountRef = useRef(0);

  const showLoading = externalUploading ?? internalUploading;

  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > maxSize * 1024 * 1024) {
        return `文件 "${file.name}" 超过最大大小 ${maxSize}MB`;
      }
      if (accept && accept !== '*') {
        const acceptedTypes = accept.split(',').map((t) => t.trim());
        const fileType = file.type;
        const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
        const isAccepted = acceptedTypes.some((type) => {
          if (type.endsWith('/*')) return fileType.startsWith(type.replace('/*', '/'));
          if (type.startsWith('.')) return fileExt === type.toLowerCase();
          return fileType === type;
        });
        if (!isAccepted) return `文件类型 "${fileType || fileExt}" 不被接受`;
      }
      return null;
    },
    [accept, maxSize]
  );

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const newFiles: FilePreview[] = [];
      const errors: string[] = [];
      if (!multiple && fileList.length > 1) {
        setError('一次只能上传一个文件');
        return;
      }
      const filesToProcess = Array.from(fileList).slice(0, multiple ? maxFiles : 1);

      for (const file of filesToProcess) {
        const validationError = validateFile(file);
        if (validationError) {
          errors.push(validationError);
          continue;
        }
        let preview: string | null = null;
        if (file.type.startsWith('image/')) preview = URL.createObjectURL(file);
        newFiles.push({ file, preview });
      }

      setError(errors.length > 0 ? errors.join('\n') : null);

      if (newFiles.length > 0) {
        if (multiple) {
          setFiles((prev) => [...prev, ...newFiles].slice(0, maxFiles));
        } else {
          files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
          setFiles(newFiles);
        }
        try {
          if (externalUploading === undefined) setInternalUploading(true);
          await onUpload(newFiles.map((f) => f.file));
        } finally {
          if (externalUploading === undefined) setInternalUploading(false);
        }
      }
    },
    [files, maxFiles, multiple, onUpload, validateFile, externalUploading]
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCountRef.current++;
      if (!disabled) setIsDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current--;
    if (dragCountRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCountRef.current = 0;
      setIsDragging(false);
      if (disabled) return;
      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) await processFiles(droppedFiles);
    },
    [disabled, processFiles]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (selectedFiles && selectedFiles.length > 0) await processFiles(selectedFiles);
      e.target.value = '';
    },
    [processFiles]
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      const removed = newFiles.splice(index, 1)[0];
      if (removed.preview) URL.revokeObjectURL(removed.preview);
      return newFiles;
    });
  }, []);

  const openFileDialog = useCallback(() => {
    if (disabled || showLoading) return;
    inputRef.current?.click();
  }, [disabled, showLoading]);

  const acceptHint = accept.replace(/image\/\*/g, '图片').replace(/,/g, ' / ');

  // ============= COMPACT variant =============
  if (resolvedVariant === 'compact') {
    return (
      <div
        className={cn('relative inline-flex', className)}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openFileDialog}
          disabled={disabled || showLoading}
          className={cn(
            'gap-2 transition-all',
            isDragging && 'border-primary bg-primary/10 ring-2 ring-primary/30'
          )}
        >
          {showLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {label || (isDragging ? '释放以上传' : '选择文件')}
        </Button>
        {error && <p className="text-xs text-destructive mt-1 absolute top-full left-0">{error}</p>}
      </div>
    );
  }

  // ============= THUMBNAIL variant =============
  if (resolvedVariant === 'thumbnail') {
    return (
      <div className={cn('space-y-1', className)}>
        {label && <div className="text-xs text-muted-foreground font-medium">{label}</div>}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={openFileDialog}
          className={cn(
            'group relative aspect-square w-full overflow-hidden rounded-xl border-2 border-dashed transition-all duration-200',
            'flex items-center justify-center cursor-pointer',
            currentUrl
              ? 'border-border/60 bg-muted/20'
              : 'border-border/60 bg-gradient-to-br from-muted/40 to-muted/10 hover:from-primary/5 hover:to-primary/10',
            isDragging && 'border-primary bg-primary/10 scale-[1.02] ring-2 ring-primary/30 shadow-lg shadow-primary/20',
            (disabled || showLoading) && 'opacity-60 cursor-not-allowed'
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled}
          />

          {currentUrl ? (
            <>
              <img
                src={currentUrl}
                alt={label || 'preview'}
                className="absolute inset-0 w-full h-full object-contain"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2 gap-1">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openFileDialog();
                    }}
                    className="p-1.5 rounded-md bg-white/90 text-foreground hover:bg-white transition-colors"
                    title="替换"
                  >
                    <Upload className="h-3.5 w-3.5" />
                  </button>
                  {onRemove && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                      }}
                      className="p-1.5 rounded-md bg-white/90 text-destructive hover:bg-white transition-colors"
                      title="移除"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1.5 px-2 text-center">
              <div
                className={cn(
                  'p-2 rounded-full transition-all duration-200',
                  isDragging
                    ? 'bg-primary/20 scale-110'
                    : 'bg-background/60 group-hover:bg-primary/10 group-hover:scale-105'
                )}
              >
                {emptyIcon ?? (
                  <ImagePlus
                    className={cn(
                      'h-5 w-5 transition-colors',
                      isDragging ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
                    )}
                  />
                )}
              </div>
              <span className="text-[10px] text-muted-foreground leading-tight">
                {isDragging ? '释放上传' : '拖拽 / 点击'}
              </span>
            </div>
          )}

          {showLoading && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center backdrop-blur-sm">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}

          {/* Drag pulse ring */}
          {isDragging && (
            <div className="absolute inset-0 rounded-xl border-2 border-primary animate-pulse pointer-events-none" />
          )}
        </div>
        {hint && <p className="text-[10px] text-muted-foreground/70">{hint}</p>}
        {error && <p className="text-[10px] text-destructive">{error}</p>}
      </div>
    );
  }

  // ============= DEFAULT variant =============
  return (
    <div className={cn('space-y-3', className)}>
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={openFileDialog}
        className={cn(
          'group relative overflow-hidden border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all duration-300',
          'bg-gradient-to-br from-muted/30 via-muted/10 to-transparent',
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.01] shadow-xl shadow-primary/20 ring-2 ring-primary/30'
            : 'border-border/60 hover:border-primary/50 hover:bg-muted/40 hover:shadow-md',
          (disabled || showLoading) && 'opacity-60 cursor-not-allowed pointer-events-none'
        )}
      >
        {/* Decorative corners */}
        <div
          className={cn(
            'pointer-events-none absolute inset-0 transition-opacity duration-300',
            isDragging ? 'opacity-100' : 'opacity-0'
          )}
        >
          <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-primary rounded-tl-md" />
          <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-primary rounded-tr-md" />
          <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-primary rounded-bl-md" />
          <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-primary rounded-br-md" />
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />

        {children || (
          <div className="flex flex-col items-center gap-3 relative">
            <div
              className={cn(
                'relative p-4 rounded-2xl transition-all duration-300',
                isDragging
                  ? 'bg-primary/15 scale-110'
                  : 'bg-background/80 shadow-sm group-hover:bg-primary/10 group-hover:scale-105'
              )}
            >
              {showLoading ? (
                <Loader2 className="h-7 w-7 text-primary animate-spin" />
              ) : (
                <Upload
                  className={cn(
                    'h-7 w-7 transition-all duration-300',
                    isDragging
                      ? 'text-primary -translate-y-0.5'
                      : 'text-muted-foreground group-hover:text-primary group-hover:-translate-y-0.5'
                  )}
                />
              )}
              {/* Pulse ring while dragging */}
              {isDragging && (
                <span className="absolute inset-0 rounded-2xl bg-primary/20 animate-ping" />
              )}
            </div>
            <div className="space-y-1">
              <p
                className={cn(
                  'text-sm font-semibold transition-colors',
                  isDragging ? 'text-primary' : 'text-foreground'
                )}
              >
                {showLoading
                  ? '上传中...'
                  : isDragging
                  ? '释放以上传文件'
                  : label || '拖拽文件到此处或点击选择'}
              </p>
              <p className="text-xs text-muted-foreground">
                {hint || (
                  <>
                    支持 {acceptHint} · 最大 {maxSize}MB
                    {multiple && ` · 最多 ${maxFiles} 个`}
                  </>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive whitespace-pre-line bg-destructive/10 border border-destructive/30 rounded-lg p-2">
          {error}
        </p>
      )}

      {/* File previews */}
      {showPreview && files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {files.map((file, index) => (
            <div
              key={`${file.file.name}-${index}`}
              className="relative group rounded-xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              {file.preview ? (
                <img src={file.preview} alt={file.file.name} className="w-full aspect-square object-cover" />
              ) : (
                <div className="w-full aspect-square flex items-center justify-center bg-muted">
                  {file.file.type.includes('image') ? (
                    <FileImage className="h-8 w-8 text-muted-foreground" />
                  ) : (
                    <FileIcon className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2">
                <p className="text-xs text-white font-medium truncate">{file.file.name}</p>
                <p className="text-[10px] text-white/70">{formatBytes(file.file.size)}</p>
              </div>
              <div className="absolute top-1 left-1 p-0.5 rounded-full bg-emerald-500/90 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <CheckCircle2 className="h-3 w-3" />
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
