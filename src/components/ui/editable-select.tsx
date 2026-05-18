import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pencil, ListChecks, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const CUSTOM_SENTINEL = '__custom__';

export interface EditableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  customLabel?: string;
  className?: string;
  inputPlaceholder?: string;
  disabled?: boolean;
}

/**
 * 下拉 + 手动输入 二合一控件。
 * - 当 value 命中 options：显示 Select
 * - 当 value 为自定义值或用户主动选了"自定义..."：切换为 Input
 */
export function EditableSelect({
  value,
  onValueChange,
  options,
  placeholder = '请选择',
  customLabel = '自定义...',
  className,
  inputPlaceholder = '请输入自定义内容',
  disabled,
}: EditableSelectProps) {
  const isCustomValue = !!value && !options.includes(value);
  const [manualMode, setManualMode] = React.useState(isCustomValue);

  React.useEffect(() => {
    if (isCustomValue) setManualMode(true);
  }, [isCustomValue]);

  if (manualMode) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <Input
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={inputPlaceholder}
          className="h-9 flex-1"
          disabled={disabled}
          autoFocus={!isCustomValue}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          title="切回下拉选择"
          disabled={disabled}
          onClick={() => {
            onValueChange('');
            setManualMode(false);
          }}
        >
          <ListChecks className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Select
      value={options.includes(value) ? value : ''}
      disabled={disabled}
      onValueChange={(v) => {
        if (v === CUSTOM_SENTINEL) {
          setManualMode(true);
          onValueChange('');
          return;
        }
        onValueChange(v);
      }}
    >
      <SelectTrigger className={cn('h-9', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value={CUSTOM_SENTINEL}>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Pencil className="h-3 w-3" />
            {customLabel}
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
