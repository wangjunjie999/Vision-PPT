import { useState, useMemo, useRef, memo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Check, X, Camera, Aperture, Lightbulb, Cpu, ChevronDown, ChevronUp, Filter, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { isTelecentricHardware, getOpticalFieldLabels } from '@/utils/telecentric';

type HardwareType = 'camera' | 'lens' | 'light' | 'controller';

interface HardwareItem {
  id: string;
  brand: string;
  model: string;
  enabled: boolean;
  image_url?: string | null;
  tags?: string[] | null;
  // Camera specific
  resolution?: string;
  interface?: string;
  sensor_size?: string;
  frame_rate?: number;
  shutter_type?: string | null;
  // Lens specific
  focal_length?: string;
  aperture?: string;
  mount?: string;
  max_sensor_size?: string | null;
  resolving_power?: number | null;
  // Light specific
  type?: string;
  color?: string;
  power?: string;
  // Controller specific
  cpu?: string;
  memory?: string;
  gpu?: string | null;
  performance?: string;
}

interface HardwareSelectorProps {
  type: HardwareType;
  items: HardwareItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  recommendation?: string;
  warningIds?: Record<string, string>;
  className?: string;
}

const typeConfig = {
  camera: {
    icon: Camera,
    title: '相机',
    placeholder: '搜索相机型号或品牌...',
    color: 'from-blue-500/20 to-cyan-500/20',
    iconColor: 'text-blue-500',
    getSubtitle: (item: HardwareItem) => item.resolution || '',
    getSpecs: (item: HardwareItem) => [
      { label: '接口', value: item.interface },
      { label: '传感器', value: item.sensor_size },
      { label: '帧率', value: item.frame_rate ? `${item.frame_rate}fps` : undefined },
      { label: '快门', value: item.shutter_type || undefined },
    ],
  },
  lens: {
    icon: Aperture,
    title: '镜头',
    placeholder: '搜索镜头型号或品牌...',
    color: 'from-purple-500/20 to-pink-500/20',
    iconColor: 'text-purple-500',
    getSubtitle: (item: HardwareItem) => [
      item.focal_length
        ? (isTelecentricHardware(item) ? `工作距离 ${item.focal_length}` : item.focal_length)
        : '',
      item.max_sensor_size ? `靶面 ${item.max_sensor_size}` : '',
    ].filter(Boolean).join(' · '),
    getSpecs: (item: HardwareItem) => [
      { label: getOpticalFieldLabels(isTelecentricHardware(item)).apertureLabel, value: item.aperture },
      { label: '靶面', value: item.max_sensor_size },
      { label: '卡口', value: item.mount },
    ],
  },
  light: {
    icon: Lightbulb,
    title: '光源',
    placeholder: '搜索光源型号或品牌...',
    color: 'from-amber-500/20 to-orange-500/20',
    iconColor: 'text-amber-500',
    getSubtitle: (item: HardwareItem) => item.type || '',
    getSpecs: (item: HardwareItem) => [
      { label: '颜色', value: item.color },
      { label: '功率', value: item.power },
    ],
  },
  controller: {
    icon: Cpu,
    title: '工控机',
    placeholder: '搜索工控机型号或品牌...',
    color: 'from-emerald-500/20 to-teal-500/20',
    iconColor: 'text-emerald-500',
    getSubtitle: (item: HardwareItem) => item.performance || '',
    getSpecs: (item: HardwareItem) => [
      { label: 'CPU', value: item.cpu },
      { label: '内存', value: item.memory },
      { label: 'GPU', value: item.gpu || '无' },
    ],
  },
};

// Simplified animation configs for better performance
const quickTransition = { duration: 0.15 };

function HardwareSelectorComponent({
  type,
  items,
  selectedId,
  onSelect,
  recommendation,
  warningIds,
  className,
}: HardwareSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const config = typeConfig[type];
  const Icon = config.icon;

  const enabledItems = useMemo(() => items.filter(item => item.enabled), [items]);

  const brands = useMemo(() => {
    const brandSet = new Set(enabledItems.map(item => item.brand));
    return Array.from(brandSet).sort();
  }, [enabledItems]);

  const filteredItems = useMemo(() => {
    return enabledItems.filter(item => {
      const matchesSearch = searchQuery === '' || 
        item.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.model.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesBrand = selectedBrands.length === 0 || 
        selectedBrands.includes(item.brand);
      
      return matchesSearch && matchesBrand;
    });
  }, [enabledItems, searchQuery, selectedBrands]);

  const selectedItem = useMemo(() => 
    enabledItems.find(item => item.id === selectedId),
    [enabledItems, selectedId]
  );

  const toggleBrand = useCallback((brand: string) => {
    setSelectedBrands(prev => 
      prev.includes(brand) 
        ? prev.filter(b => b !== brand)
        : [...prev, brand]
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedBrands([]);
  }, []);

  const handleSelect = useCallback((id: string) => {
    onSelect(id);
    setIsExpanded(false);
  }, [onSelect]);

  const handleToggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.div
            className={cn("p-1.5 rounded-md bg-gradient-to-br", config.color)}
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <Icon className={cn("h-4 w-4", config.iconColor)} />
          </motion.div>
          <span className="text-sm font-medium">{config.title}</span>
          {recommendation && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Badge variant="accent" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                推荐: {recommendation}
              </Badge>
            </motion.div>
          )}
        </div>
        <AnimatePresence>
          {selectedItem && !isExpanded && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => onSelect('')}
              >
                <X className="h-3 w-3 mr-1" />
                清除
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Selected Item Display / Expand Button */}
      <button
        type="button"
        onClick={handleToggleExpand}
        className={cn(
          "w-full p-3 rounded-xl border-2 text-left transition-all relative overflow-hidden",
          isExpanded 
            ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" 
            : selectedItem 
              ? "border-border bg-card hover:border-primary/50 hover:shadow-md" 
              : "border-dashed border-muted-foreground/30 bg-muted/10 hover:border-primary/30 hover:bg-muted/20"
        )}
      >
        {/* Animated background gradient */}
        <motion.div 
          className={cn(
            "absolute inset-0 bg-gradient-to-r opacity-0 transition-opacity",
            config.color
          )}
          animate={{ opacity: isExpanded ? 0.5 : 0 }}
        />
        
        <div className="flex items-center justify-between relative z-10">
          <AnimatePresence mode="wait">
            {selectedItem ? (
              <motion.div
                key="selected"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={quickTransition}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                <motion.div
                  className="relative"
                  whileHover={{ scale: 1.05 }}
                >
                  {selectedItem.image_url ? (
                    <img 
                      src={selectedItem.image_url} 
                      alt={selectedItem.model}
                      className="w-12 h-12 rounded-lg object-cover bg-muted ring-2 ring-primary/20"
                    />
                  ) : (
                    <div className={cn(
                      "w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center",
                      config.color
                    )}>
                      <Icon className={cn("h-6 w-6", config.iconColor)} />
                    </div>
                  )}
                  <motion.div 
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20, delay: 0.1 }}
                  >
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </motion.div>
                </motion.div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm truncate block">
                    {selectedItem.brand} {selectedItem.model}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {config.getSubtitle(selectedItem)}
                  </span>
                </div>
              </motion.div>
            ) : (
              <motion.span
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm text-muted-foreground flex items-center gap-2"
              >
                <Icon className="h-4 w-4" />
                点击选择{config.title}...
              </motion.span>
            )}
          </AnimatePresence>
          
          <ChevronDown className={cn(
            "h-5 w-5 text-muted-foreground shrink-0 ml-2 transition-transform duration-200",
            isExpanded && "rotate-180"
          )} />
        </div>
      </button>

      {/* Expanded Selection Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="border-2 rounded-xl bg-card/80 backdrop-blur-md shadow-xl">
              {/* Search & Filter */}
              <motion.div 
                className="p-4 border-b space-y-3 bg-muted/30"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={config.placeholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 bg-background/80 border-2 focus:border-primary"
                  />
                </div>
                
                {/* Brand Filter */}
                {brands.length > 0 && (
                  <motion.div 
                    className="flex flex-wrap gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                  >
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
                      <Filter className="h-3 w-3" />
                      品牌:
                    </div>
                    {brands.map((brand) => (
                      <Badge
                        key={brand}
                        variant={selectedBrands.includes(brand) ? "default" : "outline"}
                        className={cn(
                          "cursor-pointer text-xs px-2.5 py-1 transition-all hover:scale-105",
                          selectedBrands.includes(brand) 
                            ? "bg-primary text-primary-foreground shadow-md" 
                            : "hover:bg-accent hover:border-primary/50"
                        )}
                        onClick={() => toggleBrand(brand)}
                      >
                        {brand}
                      </Badge>
                    ))}
                    <AnimatePresence>
                      {(searchQuery || selectedBrands.length > 0) && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={clearFilters}
                          >
                            <X className="h-3 w-3 mr-1" />
                            清除筛选
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </motion.div>

              {/* Items Grid - Using native scroll */}
              <div 
                ref={scrollContainerRef}
                className="max-h-[320px] overflow-y-auto overscroll-contain"
                style={{ scrollbarGutter: 'stable' }}
              >
                <div className="p-3 space-y-2">
                  {filteredItems.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                      <Icon className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      没有找到匹配的{config.title}
                    </div>
                  ) : (
                    filteredItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item.id)}
                        className={cn(
                          "w-full p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden",
                          item.id === selectedId
                            ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                            : "border-border/50 hover:border-primary/30 hover:bg-accent/30"
                        )}
                      >
                        {/* Background gradient */}
                        {item.id === selectedId && (
                          <div className={cn(
                            "absolute inset-0 bg-gradient-to-r pointer-events-none opacity-30",
                            config.color
                          )} />
                        )}
                        
                        <div className="flex gap-4 relative z-10">
                          {/* Image */}
                          <div className="relative shrink-0">
                            {item.image_url ? (
                              <img 
                                src={item.image_url} 
                                alt={item.model}
                                className={cn(
                                  "w-16 h-16 rounded-xl object-cover bg-muted transition-all",
                                  item.id === selectedId ? "ring-2 ring-primary" : "ring-1 ring-border"
                                )}
                              />
                            ) : (
                              <div className={cn(
                                "w-16 h-16 rounded-xl bg-gradient-to-br flex items-center justify-center transition-all",
                                config.color,
                                item.id === selectedId ? "ring-2 ring-primary" : ""
                              )}>
                                <Icon className={cn("h-8 w-8", config.iconColor)} />
                              </div>
                            )}
                            
                            {/* Selection indicator */}
                            {item.id === selectedId && (
                              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
                                <Check className="h-3.5 w-3.5 text-primary-foreground" />
                              </div>
                            )}
                          </div>
                          
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn("font-semibold text-sm truncate", warningIds?.[item.id] && "text-amber-700 dark:text-amber-300")}>
                                {item.brand} {item.model}
                              </span>
                              {warningIds?.[item.id] && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500 text-amber-600 dark:text-amber-400 shrink-0">
                                  {warningIds[item.id]}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {config.getSubtitle(item)}
                            </div>
                            
                            {/* Specs */}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                              {config.getSpecs(item)
                                .filter(spec => spec.value)
                                .map((spec, idx) => (
                                  <span key={idx} className="text-[11px] text-muted-foreground">
                                    <span className="text-foreground/70 font-medium">{spec.label}:</span> {spec.value}
                                  </span>
                                ))
                              }
                            </div>
                            
                            {/* Tags */}
                            {item.tags && item.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {item.tags.slice(0, 4).map((tag, idx) => (
                                  <Badge 
                                    key={idx} 
                                    variant="secondary" 
                                    className="text-[10px] px-2 py-0.5 bg-background/50"
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                                {item.tags.length > 4 && (
                                  <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                                    +{item.tags.length - 4}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Footer */}
              <motion.div 
                className="p-3 border-t bg-muted/30 flex justify-between items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <span className="text-xs text-muted-foreground flex items-center gap-2">
                  <motion.span
                    key={filteredItems.length}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    className="font-medium text-foreground"
                  >
                    {filteredItems.length}
                  </motion.span>
                  项可选
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => setIsExpanded(false)}
                >
                  <ChevronUp className="h-3 w-3" />
                  收起
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Memoized export for performance
export const HardwareSelector = memo(HardwareSelectorComponent);
