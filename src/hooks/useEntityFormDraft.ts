import { useCallback, useEffect, useMemo } from 'react';

export type EntityFormDraftType = 'project' | 'workstation' | 'module';

export interface EntityFormDraftEnvelope<T> {
  schemaVersion: number;
  savedAt: string;
  entityUpdatedAt?: string | null;
  payload: T;
}

export const ENTITY_FORM_DRAFT_SCHEMA_VERSION = 1;

export function getEntityFormDraftKey(entityType: EntityFormDraftType, entityId: string) {
  return `vision-ppt:draft:${entityType}:${entityId}:v${ENTITY_FORM_DRAFT_SCHEMA_VERSION}`;
}

export function stringifyFormDraft(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function getLocalStorage() {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function readEntityFormDraft<T>(
  entityType: EntityFormDraftType,
  entityId: string | null | undefined,
) {
  if (!entityId) return null;

  try {
    const storage = getLocalStorage();
    const raw = storage?.getItem(getEntityFormDraftKey(entityType, entityId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as EntityFormDraftEnvelope<T>;
    if (parsed.schemaVersion !== ENTITY_FORM_DRAFT_SCHEMA_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeEntityFormDraft<T>(
  entityType: EntityFormDraftType,
  entityId: string | null | undefined,
  payload: T,
  entityUpdatedAt?: string | null,
) {
  if (!entityId) return;

  try {
    const storage = getLocalStorage();
    const envelope: EntityFormDraftEnvelope<T> = {
      schemaVersion: ENTITY_FORM_DRAFT_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      entityUpdatedAt,
      payload,
    };
    storage?.setItem(getEntityFormDraftKey(entityType, entityId), JSON.stringify(envelope));
  } catch {
    // Draft persistence is a convenience feature; storage failures must not block editing.
  }
}

export function clearEntityFormDraft(
  entityType: EntityFormDraftType,
  entityId: string | null | undefined,
) {
  if (!entityId) return;

  try {
    getLocalStorage()?.removeItem(getEntityFormDraftKey(entityType, entityId));
  } catch {
    // Ignore storage failures.
  }
}

interface UseEntityFormDraftOptions<T> {
  entityType: EntityFormDraftType;
  entityId: string | null | undefined;
  value: T;
  isDirty: boolean;
  enabled?: boolean;
  entityUpdatedAt?: string | null;
  debounceMs?: number;
}

export function useEntityFormDraft<T>({
  entityType,
  entityId,
  value,
  isDirty,
  enabled = true,
  entityUpdatedAt,
  debounceMs = 400,
}: UseEntityFormDraftOptions<T>) {
  const draftKey = useMemo(
    () => (entityId ? getEntityFormDraftKey(entityType, entityId) : null),
    [entityId, entityType],
  );

  const readDraft = useCallback(
    () => readEntityFormDraft<T>(entityType, entityId),
    [entityId, entityType],
  );

  const clearDraft = useCallback(
    () => clearEntityFormDraft(entityType, entityId),
    [entityId, entityType],
  );

  const saveDraft = useCallback(
    () => writeEntityFormDraft(entityType, entityId, value, entityUpdatedAt),
    [entityId, entityType, entityUpdatedAt, value],
  );

  useEffect(() => {
    if (!enabled || !entityId || !isDirty) return;

    const handle = window.setTimeout(saveDraft, debounceMs);
    return () => window.clearTimeout(handle);
  }, [debounceMs, enabled, entityId, isDirty, saveDraft]);

  return {
    draftKey,
    readDraft,
    clearDraft,
    saveDraft,
  };
}
