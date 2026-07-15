import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectTree } from './ProjectTree';

const mockReorderProjects = vi.fn();
const mockReorderWorkstations = vi.fn();
const mockReorderModules = vi.fn();
const mockMoveWorkstation = vi.fn();
const mockMoveModule = vi.fn();

const mockData = {
  projects: [
    { id: 'project-1', code: 'PRJ', name: '项目A', status: 'draft' },
    { id: 'project-2', code: 'PRK', name: '项目B', status: 'draft' },
  ],
  workstations: [
    {
      id: 'ws-1',
      project_id: 'project-1',
      code: 'DM2602000.401',
      name: '磁钢漏插检测',
      status: 'complete',
    },
    {
      id: 'ws-2',
      project_id: 'project-2',
      code: 'DM2602000.402',
      name: '端盖检测',
      status: 'draft',
    },
  ],
  modules: [
    { id: 'module-a', workstation_id: 'ws-1', name: '模块A', type: 'defect', status: 'draft' },
    { id: 'module-b', workstation_id: 'ws-1', name: '模块B', type: 'ocr', status: 'draft' },
    { id: 'module-c', workstation_id: 'ws-2', name: '模块C', type: 'measurement', status: 'draft' },
  ],
  layouts: [
    { id: 'layout-1', workstation_id: 'ws-1' },
  ],
  loading: false,
  selectedProjectId: 'project-1',
  selectedWorkstationId: null,
  selectedModuleId: null,
  selectProject: vi.fn(),
  selectWorkstation: vi.fn(),
  selectModule: vi.fn(),
  deleteProject: vi.fn(),
  deleteWorkstation: vi.fn(),
  deleteModule: vi.fn(),
  duplicateProject: vi.fn(),
  duplicateWorkstation: vi.fn(),
  duplicateModule: vi.fn(),
  reorderProjects: mockReorderProjects,
  reorderWorkstations: mockReorderWorkstations,
  reorderModules: mockReorderModules,
  moveWorkstation: mockMoveWorkstation,
  moveModule: mockMoveModule,
  updateProject: vi.fn(),
  updateWorkstation: vi.fn(),
  updateModule: vi.fn(),
  getProjectWorkstations: (projectId: string) => mockData.workstations.filter(ws => ws.project_id === projectId),
  getWorkstationModules: (workstationId: string) => mockData.modules.filter(mod => mod.workstation_id === workstationId),
};

vi.mock('@/contexts/DataContext', () => ({
  useData: () => mockData,
}));

vi.mock('@/contexts/GuideContext', () => ({
  useGuide: () => ({
    currentStep: 'complete',
    isGuideActive: false,
    dismissGuide: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function dataTransferMock() {
  const data = new Map<string, string>();
  return {
    effectAllowed: '',
    dropEffect: '',
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) || '',
  };
}

describe('ProjectTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the saved workstation code instead of generated sequence code', () => {
    render(<ProjectTree />);

    expect(screen.getByText('DM2602000.401')).toBeInTheDocument();
    expect(screen.queryByText('PRJ.01')).not.toBeInTheDocument();
  });

  it('reorders modules within the same workstation by drag and drop', () => {
    render(<ProjectTree />);

    fireEvent.click(screen.getByText('磁钢漏插检测'));

    const moduleARow = screen.getByText('模块A').closest('.group') as HTMLElement;
    const moduleBRow = screen.getByText('模块B').closest('.group') as HTMLElement;
    const moduleBHandle = within(moduleBRow).getByLabelText('拖拽调整顺序');
    moduleARow.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 200,
      bottom: 20,
      width: 200,
      height: 20,
      toJSON: () => ({}),
    }));
    const dataTransfer = dataTransferMock();

    fireEvent.dragStart(moduleBHandle, { dataTransfer });
    expect(JSON.parse(dataTransfer.getData('text/plain'))).toMatchObject({ type: 'module', id: 'module-b' });
    fireEvent.dragOver(moduleARow, { dataTransfer, clientY: 1 });
    fireEvent.drop(moduleARow, { dataTransfer, clientY: 1 });

    expect(mockReorderModules).toHaveBeenCalledWith('ws-1', ['module-b', 'module-a']);
  });

  it('moves a workstation into another project by drag and drop', () => {
    render(<ProjectTree />);

    const sourceRow = screen.getByText('磁钢漏插检测').closest('.group') as HTMLElement;
    const targetRow = screen.getByText('项目B').closest('.group') as HTMLElement;
    const sourceHandle = within(sourceRow).getByLabelText('拖拽调整顺序');
    const dataTransfer = dataTransferMock();

    fireEvent.dragStart(sourceHandle, { dataTransfer });
    fireEvent.dragOver(targetRow, { dataTransfer, clientY: 18 });
    fireEvent.drop(targetRow, { dataTransfer, clientY: 18 });

    expect(mockMoveWorkstation).toHaveBeenCalledWith('ws-1', 'project-2', ['ws-2', 'ws-1']);
  });

  it('moves a module into another workstation by drag and drop', () => {
    render(<ProjectTree />);

    fireEvent.click(screen.getByText('磁钢漏插检测'));
    const sourceRow = screen.getByText('模块A').closest('.group') as HTMLElement;
    const targetRow = screen.getByText('端盖检测').closest('.group') as HTMLElement;
    const sourceHandle = within(sourceRow).getByLabelText('拖拽调整顺序');
    const dataTransfer = dataTransferMock();

    fireEvent.dragStart(sourceHandle, { dataTransfer });
    fireEvent.dragOver(targetRow, { dataTransfer, clientY: 18 });
    fireEvent.drop(targetRow, { dataTransfer, clientY: 18 });

    expect(mockMoveModule).toHaveBeenCalledWith('module-a', 'ws-2', ['module-c', 'module-a']);
  });
});
