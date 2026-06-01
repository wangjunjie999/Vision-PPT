import { useEffect, useState, useMemo } from 'react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import {
  FolderOpen, Cpu, Box, Search, Plus, FileText, Moon, Sun,
  Settings, Palette, Command as CommandIcon, Zap
} from 'lucide-react';
import { useData } from '@/contexts/useData';
import { useHardware } from '@/contexts/HardwareContext';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const { projects, workstations, modules, selectProject, selectWorkstation, selectModule } = useData();
  const { cameras, lenses, lights } = useHardware();
  const { setCurrentRole, currentRole } = useAppStore();
  const { theme, setTheme } = useTheme();

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [search, setSearch] = useState('');

  // Build searchable items
  const projectItems = useMemo(() =>
    projects.map(p => ({
      id: p.id,
      label: `${p.code ? `[${p.code}] ` : ''}${p.name}`,
      sublabel: p.customer || '',
      icon: FolderOpen,
    })),
    [projects]
  );

  const workstationItems = useMemo(() =>
    workstations.map(ws => {
      const proj = projects.find(p => p.id === ws.project_id);
      return {
        id: ws.id,
        projectId: ws.project_id,
        label: `${ws.code ? `[${ws.code}] ` : ''}${ws.name}`,
        sublabel: proj?.name || '',
        icon: Cpu,
      };
    }),
    [workstations, projects]
  );

  const moduleItems = useMemo(() =>
    modules.map(m => {
      const ws = workstations.find(w => w.id === m.workstation_id);
      return {
        id: m.id,
        workstationId: m.workstation_id,
        projectId: ws ? ws.project_id : '',
        label: m.name,
        sublabel: ws?.name || '',
        icon: Box,
      };
    }),
    [modules, workstations]
  );

  const hardwareItems = useMemo(() => [
    ...cameras.map(c => ({ id: c.id, label: `${c.brand} ${c.model}`, sublabel: c.resolution, category: '相机' })),
    ...lenses.map(l => ({ id: l.id, label: `${l.brand} ${l.model}`, sublabel: l.focal_length, category: '镜头' })),
    ...lights.map(l => ({ id: l.id, label: `${l.brand} ${l.model}`, sublabel: l.type, category: '光源' })),
  ], [cameras, lenses, lights]);

  const handleSelectProject = (id: string) => {
    selectProject(id);
    setOpen(false);
    toast.success('已跳转到项目');
  };

  const handleSelectWorkstation = (projectId: string, wsId: string) => {
    selectProject(projectId);
    setTimeout(() => selectWorkstation(wsId), 50);
    setOpen(false);
    toast.success('已跳转到工位');
  };

  const handleSelectModule = (projectId: string, wsId: string, moduleId: string) => {
    selectProject(projectId);
    setTimeout(() => {
      selectWorkstation(wsId);
      setTimeout(() => selectModule(moduleId), 50);
    }, 50);
    setOpen(false);
    toast.success('已跳转到模块');
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="搜索项目、工位、模块、硬件或操作..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>未找到匹配结果</CommandEmpty>

        {/* Quick actions */}
        <CommandGroup heading="快捷操作">
          <CommandItem onSelect={() => {
            setTheme(theme === 'dark' ? 'light' : 'dark');
            setOpen(false);
            toast.success(theme === 'dark' ? '已切换到浅色模式' : '已切换到暗色模式');
          }}>
            {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            <span>切换{theme === 'dark' ? '浅色' : '暗色'}模式</span>
          </CommandItem>
          <CommandItem onSelect={() => {
            setCurrentRole(currentRole === 'admin' ? 'user' : 'admin');
            setOpen(false);
            toast.success(`已切换到${currentRole === 'admin' ? '用户' : '管理员'}模式`);
          }}>
            <Settings className="mr-2 h-4 w-4" />
            <span>切换到{currentRole === 'admin' ? '用户' : '管理员'}模式</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Projects */}
        {projectItems.length > 0 && (
          <CommandGroup heading="项目">
            {projectItems.map(item => (
              <CommandItem key={item.id} onSelect={() => handleSelectProject(item.id)}>
                <item.icon className="mr-2 h-4 w-4 text-primary" />
                <div className="flex flex-col">
                  <span>{item.label}</span>
                  {item.sublabel && <span className="text-xs text-muted-foreground">{item.sublabel}</span>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Workstations */}
        {workstationItems.length > 0 && (
          <CommandGroup heading="工位">
            {workstationItems.map(item => (
              <CommandItem key={item.id} onSelect={() => handleSelectWorkstation(item.projectId, item.id)}>
                <item.icon className="mr-2 h-4 w-4 text-accent" />
                <div className="flex flex-col">
                  <span>{item.label}</span>
                  {item.sublabel && <span className="text-xs text-muted-foreground">{item.sublabel}</span>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Modules */}
        {moduleItems.length > 0 && (
          <CommandGroup heading="模块">
            {moduleItems.map(item => (
              <CommandItem key={item.id} onSelect={() => handleSelectModule(item.projectId, item.workstationId, item.id)}>
                <item.icon className="mr-2 h-4 w-4 text-secondary" />
                <div className="flex flex-col">
                  <span>{item.label}</span>
                  {item.sublabel && <span className="text-xs text-muted-foreground">{item.sublabel}</span>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Hardware */}
        {hardwareItems.length > 0 && (
          <CommandGroup heading="硬件">
            {hardwareItems.slice(0, 20).map(item => (
              <CommandItem key={`hw-${item.id}`} onSelect={() => {
                setOpen(false);
                toast.info(`${item.category}: ${item.label}`);
              }}>
                <Zap className="mr-2 h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span>{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.category} · {item.sublabel}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

