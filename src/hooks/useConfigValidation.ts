import { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useHardware } from '@/contexts/HardwareContext';
import { quickCycleTimeCheck, checkLensCameraMatch, checkSensorCompatibility, parseFNumber } from '@/utils/visionCalcEngine';

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'hardware' | 'timing' | 'completeness';
  message: string;
  workstationId?: string;
  moduleId?: string;
  fix?: string;
}

export function useConfigValidation(projectId: string | null) {
  const { workstations, modules, layouts, getProjectWorkstations, getWorkstationModules } = useData();
  const { cameras, lenses, lights } = useHardware();

  const issues = useMemo<ValidationIssue[]>(() => {
    if (!projectId) return [];
    const result: ValidationIssue[] = [];
    const projectWs = getProjectWorkstations(projectId);

    for (const ws of projectWs) {
      const wsModules = getWorkstationModules(ws.id);
      const layout = layouts.find(l => l.workstation_id === ws.id);

      // Check: workstation has no modules
      if (wsModules.length === 0) {
        result.push({
          severity: 'warning',
          category: 'completeness',
          message: `工位「${ws.name}」尚未添加功能模块`,
          workstationId: ws.id,
          fix: '添加至少一个功能模块',
        });
      }

      // Check: no layout
      if (!layout) {
        result.push({
          severity: 'warning',
          category: 'completeness',
          message: `工位「${ws.name}」尚未配置机械布局`,
          workstationId: ws.id,
          fix: '进入工位配置布局',
        });
      }

      // Check: cycle time (delegates to shared utility)
      if (ws.cycle_time) {
        const processingTimes = wsModules.map(m => m.processing_time_limit || 0);
        const ctCheck = quickCycleTimeCheck(Number(ws.cycle_time), processingTimes);
        if (ctCheck.totalMs > 0 && !ctCheck.ok) {
          result.push({
            severity: 'error',
            category: 'timing',
            message: `工位「${ws.name}」模块处理时间 (${ctCheck.totalMs}ms) 超过工位节拍 (${ws.cycle_time}s/pcs)`,
            workstationId: ws.id,
            fix: '优化模块处理时间或增大工位节拍',
          });
        }
      }

      // Check hardware compatibility per module
      for (const mod of wsModules) {
        const selectedCameraModel = mod.selected_camera;
        const selectedLensModel = mod.selected_lens;

        if (selectedCameraModel && selectedLensModel) {
          const camera = cameras.find(c => `${c.brand} ${c.model}` === selectedCameraModel);
          const lens = lenses.find(l => `${l.brand} ${l.model}` === selectedLensModel);
          if (camera && lens) {
            // Check mount compatibility
            const compatibleModels = lens.compatible_cameras || [];
            if (compatibleModels.length > 0 && !compatibleModels.includes(camera.model)) {
              result.push({
                severity: 'error',
                category: 'hardware',
                message: `模块「${mod.name}」的镜头 ${lens.model} 与相机 ${camera.model} 不兼容`,
                workstationId: ws.id,
                moduleId: mod.id,
                fix: '更换兼容的镜头或相机',
              });
            }
          }
        }

        // Check: lens resolving power vs camera
        if (selectedCameraModel && selectedLensModel) {
          const camera = cameras.find(c => `${c.brand} ${c.model}` === selectedCameraModel);
          const lens = lenses.find(l => `${l.brand} ${l.model}` === selectedLensModel);
          if (camera && lens && camera.sensor_size && lens.aperture) {
            const fNum = parseFNumber(lens.aperture);
            const resParsed = camera.resolution?.match(/(\d+)\s*[x×*]\s*(\d+)/i);
            if (fNum && resParsed) {
              const match = checkLensCameraMatch({
                sensorSize: camera.sensor_size,
                cameraResolutionWidth: parseInt(resParsed[1]),
                fNumber: fNum,
                lensResolvingPower: lens.resolving_power ?? undefined,
              });
              if (match && match.status === 'lens_insufficient') {
                result.push({
                  severity: 'warning',
                  category: 'hardware',
                  message: `模块「${mod.name}」的镜头 ${lens.model} 分辨力不足(${match.lensResolvingLpMm} lp/mm)，低于相机奈奎斯特频率(${match.cameraNyquistLpMm} lp/mm)`,
                  workstationId: ws.id,
                  moduleId: mod.id,
                  fix: match.suggestion || '建议更换更高分辨力的镜头',
                });
              }
            }
          }
        }

        // Check: sensor compatibility / tunnel effect
        if (selectedCameraModel && selectedLensModel) {
          const camera = cameras.find(c => `${c.brand} ${c.model}` === selectedCameraModel);
          const lens = lenses.find(l => `${l.brand} ${l.model}` === selectedLensModel);
          if (camera && lens && camera.sensor_size && lens.mount) {
            const sensorResult = checkSensorCompatibility({
              sensorSize: camera.sensor_size,
              lensMount: lens.mount,
              lensMaxSensorSize: lens.max_sensor_size ?? undefined,
            });
            for (const item of sensorResult.items) {
              if (item.severity === 'error') {
                result.push({
                  severity: 'error',
                  category: 'hardware',
                  message: `模块「${mod.name}」${item.message}`,
                  workstationId: ws.id,
                  moduleId: mod.id,
                  fix: item.detail,
                });
              } else if (item.severity === 'warning') {
                result.push({
                  severity: 'warning',
                  category: 'hardware',
                  message: `模块「${mod.name}」${item.message}`,
                  workstationId: ws.id,
                  moduleId: mod.id,
                  fix: item.detail,
                });
              }
            }
          }
        }

        // Check: module missing camera selection
        if (!selectedCameraModel) {
          result.push({
            severity: 'info',
            category: 'completeness',
            message: `模块「${mod.name}」尚未选择相机`,
            workstationId: ws.id,
            moduleId: mod.id,
          });
        }
      }
    }

    return result;
  }, [projectId, workstations, modules, layouts, cameras, lenses, lights, getProjectWorkstations, getWorkstationModules]);

  const healthScore = useMemo(() => {
    if (issues.length === 0) return 100;
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const infoCount = issues.filter(i => i.severity === 'info').length;
    const penalty = errorCount * 20 + warningCount * 10 + infoCount * 3;
    return Math.max(0, 100 - penalty);
  }, [issues]);

  return { issues, healthScore };
}
