-- Add camera mount points and related fields to mechanisms table
ALTER TABLE mechanisms ADD COLUMN IF NOT EXISTS camera_mount_points jsonb DEFAULT '[]'::jsonb;
-- Format: [{ "id": "mount1", "type": "top"|"side"|"arm_end", "position": {"x": 0, "y": -50}, "rotation": 0, "description": "顶部安装点" }]

ALTER TABLE mechanisms ADD COLUMN IF NOT EXISTS compatible_camera_mounts text[] DEFAULT '{}'::text[];
-- Compatible mount types: ['top', 'side', 'angled', 'arm_end']

ALTER TABLE mechanisms ADD COLUMN IF NOT EXISTS camera_work_distance_range jsonb DEFAULT NULL;
-- Recommended work distance range: {"min": 200, "max": 500}

-- Add comment for documentation
COMMENT ON COLUMN mechanisms.camera_mount_points IS 'Array of camera mounting points with position, type, and rotation';
COMMENT ON COLUMN mechanisms.compatible_camera_mounts IS 'List of compatible camera mount types';
COMMENT ON COLUMN mechanisms.camera_work_distance_range IS 'Recommended camera work distance range in mm';