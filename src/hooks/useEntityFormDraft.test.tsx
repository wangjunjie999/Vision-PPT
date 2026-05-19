import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearEntityFormDraft,
  getEntityFormDraftKey,
  readEntityFormDraft,
  useEntityFormDraft,
  writeEntityFormDraft,
} from './useEntityFormDraft';

describe('entity form draft persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('writes, reads, and clears a typed draft envelope', () => {
    writeEntityFormDraft('project', 'project-1', { name: 'draft name' }, '2026-05-18T00:00:00.000Z');

    const draft = readEntityFormDraft<{ name: string }>('project', 'project-1');
    expect(draft?.payload).toEqual({ name: 'draft name' });
    expect(draft?.entityUpdatedAt).toBe('2026-05-18T00:00:00.000Z');

    clearEntityFormDraft('project', 'project-1');
    expect(readEntityFormDraft('project', 'project-1')).toBeNull();
  });

  it('ignores drafts from another schema version', () => {
    window.localStorage.setItem(
      getEntityFormDraftKey('module', 'module-1'),
      JSON.stringify({ schemaVersion: 999, payload: { name: 'old' } }),
    );

    expect(readEntityFormDraft('module', 'module-1')).toBeNull();
  });

  it('debounces saves while the form is dirty', () => {
    vi.useFakeTimers();

    const { rerender } = renderHook(
      ({ value, isDirty }) => useEntityFormDraft({
        entityType: 'workstation',
        entityId: 'ws-1',
        value,
        isDirty,
        debounceMs: 100,
      }),
      {
        initialProps: {
          value: { code: 'saved' },
          isDirty: false,
        },
      },
    );

    expect(readEntityFormDraft('workstation', 'ws-1')).toBeNull();

    rerender({
      value: { code: 'unsaved' },
      isDirty: true,
    });

    act(() => {
      vi.advanceTimersByTime(99);
    });
    expect(readEntityFormDraft('workstation', 'ws-1')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(readEntityFormDraft<{ code: string }>('workstation', 'ws-1')?.payload).toEqual({ code: 'unsaved' });
  });
});
