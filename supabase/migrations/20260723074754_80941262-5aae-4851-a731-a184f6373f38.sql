
-- ============================================================
-- product_media + single-annotation-per-media
-- Idempotent migration
-- ============================================================

-- 1. Table
CREATE TABLE IF NOT EXISTS public.product_media (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id uuid NOT NULL REFERENCES public.product_assets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  original_url text NOT NULL,
  display_url text,
  file_name text,
  file_size integer,
  mime_type text,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_media TO authenticated;
GRANT ALL ON public.product_media TO service_role;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_product_media_asset_sort
  ON public.product_media(asset_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_product_media_user
  ON public.product_media(user_id);

-- 4. RLS
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_media' AND policyname='Users can view their own product media') THEN
    CREATE POLICY "Users can view their own product media" ON public.product_media FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_media' AND policyname='Users can create their own product media') THEN
    CREATE POLICY "Users can create their own product media" ON public.product_media FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_media' AND policyname='Users can update their own product media') THEN
    CREATE POLICY "Users can update their own product media" ON public.product_media FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_media' AND policyname='Users can delete their own product media') THEN
    CREATE POLICY "Users can delete their own product media" ON public.product_media FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 5. updated_at trigger for product_media
DROP TRIGGER IF EXISTS update_product_media_updated_at ON public.product_media;
CREATE TRIGGER update_product_media_updated_at
  BEFORE UPDATE ON public.product_media
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Extend product_annotations
ALTER TABLE public.product_annotations
  ADD COLUMN IF NOT EXISTS media_id uuid REFERENCES public.product_media(id) ON DELETE CASCADE;
ALTER TABLE public.product_annotations
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS product_annotations_media_id_unique
  ON public.product_annotations(media_id)
  WHERE media_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_product_annotations_updated_at ON public.product_annotations;
CREATE TRIGGER update_product_annotations_updated_at
  BEFORE UPDATE ON public.product_annotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Backfill: preview_images -> product_media (idempotent via NOT EXISTS on (asset_id, sort_order, original_url))
DO $$
DECLARE
  a RECORD;
  img jsonb;
  idx int;
  url text;
BEGIN
  FOR a IN
    SELECT id, user_id, COALESCE(preview_images, '[]'::jsonb) AS previews
    FROM public.product_assets
    WHERE jsonb_typeof(COALESCE(preview_images, '[]'::jsonb)) = 'array'
      AND jsonb_array_length(COALESCE(preview_images, '[]'::jsonb)) > 0
  LOOP
    idx := 0;
    FOR img IN SELECT * FROM jsonb_array_elements(a.previews)
    LOOP
      -- Support either string entries or object entries with a url-ish key
      IF jsonb_typeof(img) = 'string' THEN
        url := trim(both '"' from img::text);
      ELSE
        url := COALESCE(img->>'url', img->>'original_url', img->>'display_url', img->>'src');
      END IF;

      IF url IS NOT NULL AND length(url) > 0 THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.product_media
          WHERE asset_id = a.id
            AND sort_order = idx
            AND original_url = url
            AND (metadata->>'source') = 'preview_images_backfill'
        ) THEN
          INSERT INTO public.product_media
            (asset_id, user_id, original_url, display_url, sort_order, is_primary, metadata)
          VALUES
            (a.id, a.user_id, url, url, idx, idx = 0,
             jsonb_build_object('source','preview_images_backfill'));
        END IF;
      END IF;
      idx := idx + 1;
    END LOOP;
  END LOOP;
END $$;

-- 8. Backfill: attach existing annotations to media
--    First annotation per asset (by created_at) -> primary media for that asset
--    Additional annotations -> clone snapshot_url into a new media, then link
DO $$
DECLARE
  ann RECORD;
  rn int;
  primary_media_id uuid;
  new_media_id uuid;
  next_sort int;
BEGIN
  FOR ann IN
    SELECT pa.id AS ann_id,
           pa.asset_id,
           pa.user_id,
           pa.snapshot_url,
           pa.created_at,
           ROW_NUMBER() OVER (PARTITION BY pa.asset_id ORDER BY pa.created_at ASC, pa.id ASC) AS rn
    FROM public.product_annotations pa
    WHERE pa.media_id IS NULL
      AND pa.asset_id IS NOT NULL
  LOOP
    IF ann.rn = 1 THEN
      -- Find primary media on the asset; if none, create one from snapshot_url
      SELECT id INTO primary_media_id
      FROM public.product_media
      WHERE asset_id = ann.asset_id
      ORDER BY is_primary DESC, sort_order ASC, created_at ASC
      LIMIT 1;

      IF primary_media_id IS NULL AND ann.snapshot_url IS NOT NULL THEN
        INSERT INTO public.product_media
          (asset_id, user_id, original_url, display_url, sort_order, is_primary, metadata)
        VALUES
          (ann.asset_id, ann.user_id, ann.snapshot_url, ann.snapshot_url, 0, true,
           jsonb_build_object('source','annotation_backfill_primary'))
        RETURNING id INTO primary_media_id;
      END IF;

      IF primary_media_id IS NOT NULL THEN
        -- Respect the unique index: only link if no other annotation already occupies it
        IF NOT EXISTS (SELECT 1 FROM public.product_annotations WHERE media_id = primary_media_id) THEN
          UPDATE public.product_annotations SET media_id = primary_media_id WHERE id = ann.ann_id;
        END IF;
      END IF;
    ELSE
      -- Extra annotation: create its own media clone
      SELECT COALESCE(MAX(sort_order), -1) + 1 INTO next_sort
      FROM public.product_media WHERE asset_id = ann.asset_id;

      INSERT INTO public.product_media
        (asset_id, user_id, original_url, display_url, sort_order, is_primary, metadata)
      VALUES
        (ann.asset_id, ann.user_id,
         COALESCE(ann.snapshot_url, ''),
         ann.snapshot_url,
         next_sort, false,
         jsonb_build_object('source','annotation_backfill_extra','annotation_id',ann.ann_id))
      RETURNING id INTO new_media_id;

      UPDATE public.product_annotations SET media_id = new_media_id WHERE id = ann.ann_id;
    END IF;
  END LOOP;
END $$;
