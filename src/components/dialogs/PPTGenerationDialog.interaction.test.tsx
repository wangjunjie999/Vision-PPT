import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PPTGenerationDialog } from './PPTGenerationDialog';

const mockSetImageQuality = vi.fn();
const productQueryState = vi.hoisted(() => ({
  media: Promise.resolve({ data: [], error: null }),
  annotations: Promise.resolve({ data: [], error: null }),
}));
interface TestTemplate {
  id: string;
  name: string;
  file_url: string;
  is_default?: boolean;
  structure_meta: {
    parsedSlides: Array<Record<string, unknown>>;
    layoutMapping: {
      mappings: Array<{
        templateSlideIndex: number;
        slideType: string;
        enabled?: boolean;
      }>;
    };
  };
}
const templateHookState = vi.hoisted(() => ({
  templates: [] as TestTemplate[],
  defaultTemplate: null as TestTemplate | null,
  isLoading: false,
}));
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
  productAssets: [] as Array<Record<string, unknown>>,
  loading: false,
  getProjectWorkstations: (projectId: string) => mockData.workstations.filter(item => item.project_id === projectId),
  getWorkstationModules: (workstationId: string) => mockData.modules.filter(item => item.workstation_id === workstationId),
  selectWorkstation: vi.fn(),
  selectModule: vi.fn(),
};

vi.mock('@/contexts/useData', () => ({ useData: () => mockData }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      builder.select = chain;
      builder.eq = chain;
      builder.in = chain;
      builder.order = chain;
      builder.then = (
        resolve: (value: unknown) => unknown,
        reject: (reason: unknown) => unknown,
      ) => (table === 'product_media'
        ? productQueryState.media
        : productQueryState.annotations).then(resolve, reject);
      return builder;
    },
  },
}));
vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({ pptImageQuality: 'high', setPPTImageQuality: mockSetImageQuality }),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/hooks/usePPTTemplates', () => ({
  usePPTTemplates: () => templateHookState,
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
    mockData.productAssets = [];
    productQueryState.media = Promise.resolve({ data: [], error: null });
    productQueryState.annotations = Promise.resolve({ data: [], error: null });
    templateHookState.templates = [];
    templateHookState.defaultTemplate = null;
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
    const startButton = await screen.findByRole('button', { name: '开始生成' });
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

  it('keeps generation disabled until the complete product snapshot is ready', async () => {
    let resolveMedia!: (value: { data: unknown[]; error: null }) => void;
    productQueryState.media = new Promise(resolve => {
      resolveMedia = resolve;
    });
    mockData.productAssets = [{
      id: 'product-1',
      scope_type: 'workstation',
      workstation_id: 'ws-1',
      product_name: 'Product A',
    }];

    openDialog();

    expect(await screen.findByRole('button', { name: '正在加载产品数据' })).toBeDisabled();
    expect(screen.getByText('正在加载产品图片和标注，完成后才能生成…')).toBeInTheDocument();

    resolveMedia({ data: [], error: null });

    expect(await screen.findByRole('button', { name: '开始生成' })).not.toBeDisabled();
  });

  it('shows product query errors and retries without generating from an empty fallback', async () => {
    mockData.productAssets = [{
      id: 'product-1',
      scope_type: 'workstation',
      workstation_id: 'ws-1',
      product_name: 'Product A',
    }];
    productQueryState.media = Promise.resolve({
      data: [],
      error: new Error('network unavailable'),
    });

    openDialog();

    expect(await screen.findByText(/产品图片和标注加载失败：network unavailable/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '产品数据加载失败' })).toBeDisabled();

    productQueryState.media = Promise.resolve({ data: [], error: null });
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    expect(await screen.findByRole('button', { name: '开始生成' })).not.toBeDisabled();
  });

  it('blocks uploaded templates that have products but no product page mapping', async () => {
    const template = {
      id: 'template-1',
      name: 'Customer template',
      file_url: 'template.pptx',
      structure_meta: {
        parsedSlides: [{ index: 0 }],
        layoutMapping: { mappings: [] },
      },
    };
    templateHookState.templates = [template];
    templateHookState.defaultTemplate = template;
    mockData.productAssets = [{
      id: 'product-1',
      scope_type: 'workstation',
      workstation_id: 'ws-1',
      product_name: 'Product A',
    }];

    openDialog();
    await screen.findByRole('button', { name: '开始生成' });
    fireEvent.click(screen.getByRole('radio', { name: /上传模板/ }));

    expect(await screen.findByText('上传模板缺少产品示意图映射')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '模板缺少产品页映射' })).toBeDisabled();
  });

  it('accepts legacy enabled-by-default product page mappings', async () => {
    const template = {
      id: 'template-1',
      name: 'Legacy customer template',
      file_url: 'template.pptx',
      structure_meta: {
        parsedSlides: [{ index: 0 }],
        layoutMapping: {
          mappings: [{ templateSlideIndex: 0, slideType: 'product_schematic' }],
        },
      },
    };
    templateHookState.templates = [template];
    templateHookState.defaultTemplate = template;
    mockData.productAssets = [{
      id: 'product-1',
      scope_type: 'workstation',
      workstation_id: 'ws-1',
      product_name: 'Product A',
    }];

    openDialog();
    await screen.findByRole('button', { name: '开始生成' });
    fireEvent.click(screen.getByRole('radio', { name: /上传模板/ }));

    await waitFor(() => {
      expect(screen.queryByText('上传模板缺少产品示意图映射')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '开始生成' })).not.toBeDisabled();
    });
  });
});
