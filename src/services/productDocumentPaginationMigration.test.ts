import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  'supabase/migrations/20260723180000_product_document_image_pagination.sql',
);

describe('product document pagination migration contract', () => {
  it('adds an idempotent product-level setting with a one-image default', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    expect(sql).toContain('ADD COLUMN IF NOT EXISTS document_images_per_page smallint');
    expect(sql).toContain('ALTER COLUMN document_images_per_page SET DEFAULT 1');
    expect(sql).toContain('ALTER COLUMN document_images_per_page SET NOT NULL');
    expect(sql).toContain('product_assets_document_images_per_page_check');
    expect(sql).toContain('CHECK (document_images_per_page IN (1, 2))');
  });

  it('normalizes missing or invalid legacy values to one image per page', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    expect(sql).toContain('SET document_images_per_page = 1');
    expect(sql).toContain('document_images_per_page NOT IN (1, 2)');
  });
});
