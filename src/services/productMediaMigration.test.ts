import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  'supabase/migrations/20260723143000_product_media_single_annotation.sql',
);

describe('product media migration contract', () => {
  it('is repeatable and preserves duplicate uploaded URLs as separate records', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.product_media');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS media_id uuid');
    expect(sql).toContain('ON CONFLICT (asset_id, legacy_key)');
    expect(sql).not.toMatch(/UNIQUE\s*\([^)]*original_url/i);
  });

  it('links legacy preview and annotation records and enforces one annotation per media', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    expect(sql).toContain("media.legacy_key LIKE 'preview:%'");
    expect(sql).toContain("'annotation:' || annotation.id::text");
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS product_annotations_one_per_media');
    expect(sql).toContain('ON public.product_annotations (media_id)');
  });
});
