import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProvider, useData } from './DataContext';

const cacheMocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
}));
const deleteEq = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));

vi.mock('@/services/offlineCache', () => ({ offlineCache: cacheMocks }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      delete: () => ({ eq: deleteEq }),
    }),
  },
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function WorkstationDeleteProbe() {
  const { workstations, layouts, modules, productAssets, deleteWorkstation } = useData();
  return (
    <div>
      <span>{[
        workstations.length,
        layouts.length,
        modules.length,
        productAssets.length,
      ].join('/')}</span>
      <button type="button" onClick={() => void deleteWorkstation('ws-1')}>删除工位</button>
    </div>
  );
}

describe('DataContext workstation deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteEq.mockResolvedValue({ error: null });
    cacheMocks.get.mockImplementation(async (key: string) => ({
      projects: [],
      workstations: [{ id: 'ws-1', project_id: 'project-1', code: 'WS-1', name: 'Deleted station' }],
      layouts: [{ id: 'layout-1', workstation_id: 'ws-1' }],
      modules: [{ id: 'module-1', workstation_id: 'ws-1', name: 'Module A' }],
      productAssets: [{ id: 'product-1', workstation_id: 'ws-1', scope_type: 'workstation', created_at: '' }],
    }[key] ?? null));
  });

  it('removes the workstation graph and invalidates every dependent cache', async () => {
    render(
      <DataProvider>
        <WorkstationDeleteProbe />
      </DataProvider>,
    );

    expect(await screen.findByText('1/1/1/1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '删除工位' }));

    expect(await screen.findByText('0/0/0/0')).toBeInTheDocument();
    await waitFor(() => {
      expect(cacheMocks.delete.mock.calls.map(([key]) => key)).toEqual([
        'workstations',
        'layouts',
        'modules',
        'productAssets',
      ]);
    });
  });
});
