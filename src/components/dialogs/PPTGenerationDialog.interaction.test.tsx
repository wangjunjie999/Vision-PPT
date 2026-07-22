import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PPTGenerationDialog } from './PPTGenerationDialog';

const mockSetImageQuality = vi.fn();
const mockData = {
  selectedProjectId: 'project-1',
  projects: [{
    id: 'project-1',
    code: 'PRJ-001',
    name: 'Demo project',
    customer: 'Demo customer',
    responsible: 'Owner',
    date: '2026-07-20',
  }],
  workstations: [
    { id: 'ws-1', project_id: 'project-1', code: 'WS-1', name: 'Station A' },
    { id: 'ws-2', project_id: 'project-1', code: 'WS-2', name: 'Station B' },
  ],
  modules: [
    { id: 'mod-1', workstation_id: 'ws-1', name: 'Module A', type: 'defect' },
    { id: 'mod-2', workstation_id: 'ws-1', name: 'Module B', type: 'ocr' },
    { id: 'mod-3', workstation_id: 'ws-2', name: 'Module C', type: 'measurement' },
  ],
  layouts: [
    { id: 'layout-1', workstation_id: 'ws-1' },
    { id: 'layout-2', workstation_id: 'ws-2' },
  ],
  loading: false,
  getProjectWorkstations: (projectId: string) => mockData.workstations.filter(item => item.project_id === projectId),
  getWorkstationModules: (workstationId: string) => mockData.modules.filter(item => item.workstation_id === workstationId),
  selectWorkstation: vi.fn(),
  selectModule: vi.fn(),
};

vi.mock('@/contexts/useData', () => ({ useData: () => mockData }));
vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({ pptImageQuality: 'high', setPPTImageQuality: mockSetImageQuality }),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/hooks/usePPTTemplates', () => ({
  usePPTTemplates: () => ({ templates: [], defaultTemplate: null, isLoading: false }),
}));
vi.mock('@/hooks/useHardware', () => ({
  useCameras: () => ({ cameras: [] }),
  useLenses: () => ({ lenses: [] }),
  useLights: () => ({ lights: [] }),
  useControllers: () => ({ controllers: [] }),
}));
vi.mock('@/hooks/useImageCache', () => ({
  useBatchImageCache: () => ({
    isDownloading: false,
    progress: { current: 0, total: 0, message: '' },
    stats: null,
    downloadAll: vi.fn(),
    findMissingCache: vi.fn().mockResolvedValue([]),
    refreshStats: vi.fn(),
    formatFileSize: vi.fn(() => '0 B'),
  }),
}));
vi.mock('@/services/pptReadiness', () => ({
  checkPPTReadiness: () => ({
    draftReady: true,
    finalReady: true,
    missing: [],
    warnings: [],
    stats: { workstationCount: 2, moduleCount: 3, missingSchematicImages: 0 },
  }),
}));
vi.mock('./PPTImagePreviewDialog', () => ({ PPTImagePreviewDialog: () => null }));

function openDialog() {
  return render(<PPTGenerationDialog open onOpenChange={vi.fn()} />);
}

describe('PPTGenerationDialog scope interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects everything once and does not restore a manually unchecked workstation', async () => {
    openDialog();
    fireEvent.click(screen.getByText('选择工位'));

    const stationA = await screen.findByLabelText('选择工位 Station A');
    expect(stationA).toBeChecked();
    fireEvent.click(stationA);
    expect(stationA).not.toBeChecked();

    fireEvent.click(screen.getByText('选择模块'));
    await screen.findByLabelText('选择模块 Module A');
    fireEvent.click(screen.getByText('选择工位'));

    expect(await screen.findByLabelText('选择工位 Station A')).not.toBeChecked();
    expect(screen.getByLabelText('选择工位 Station B')).toBeChecked();
  });

  it('supports clear/all actions and disables generation for an empty selection', async () => {
    openDialog();
    const startButton = screen.getByRole('button', { name: '开始生成' });
    fireEvent.click(screen.getByText('选择工位'));
    await screen.findByLabelText('选择工位 Station A');

    fireEvent.click(screen.getByRole('button', { name: '清空工位' }));
    expect(screen.getByLabelText('选择工位 Station A')).not.toBeChecked();
    expect(screen.getByLabelText('选择工位 Station B')).not.toBeChecked();
    expect(startButton).toBeDisabled();
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '全选工位' }));
    await waitFor(() => expect(screen.getByLabelText('选择工位 Station A')).toBeChecked());
    expect(screen.getByLabelText('选择工位 Station B')).toBeChecked();
    expect(startButton).not.toBeDisabled();
  });

  it('supports workstation group tri-state selection and preserves module state', async () => {
    openDialog();
    fireEvent.click(screen.getByText('选择模块'));
    const group = await screen.findByLabelText('选择 Station A 全部模块');
    expect(group).toBeChecked();

    fireEvent.click(group);
    expect(screen.getByLabelText('选择模块 Module A')).not.toBeChecked();
    expect(screen.getByLabelText('选择模块 Module B')).not.toBeChecked();

    fireEvent.click(screen.getByLabelText('选择模块 Module A'));
    expect(group).toHaveAttribute('aria-checked', 'mixed');

    fireEvent.click(screen.getByText('选择工位'));
    await screen.findByLabelText('选择工位 Station A');
    fireEvent.click(screen.getByText('选择模块'));
    expect(await screen.findByLabelText('选择模块 Module A')).toBeChecked();
    expect(screen.getByLabelText('选择模块 Module B')).not.toBeChecked();
  });
});
