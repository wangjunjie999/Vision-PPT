import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ModuleStep3Imaging } from './ModuleStep3Imaging';
import { ModuleStep1Basic } from './ModuleStep1Basic';
import {
  calculateLineScanResolutionPerPixel,
  convertLineScanDistanceUnit,
  getLineScanPixelCount,
} from './LineScanCameraForm';
import { getDefaultFormState, isLineScanConfigComplete, type ModuleFormState } from './types';
import { getActiveModuleConfig } from '@/utils/moduleConfig';

vi.mock('@/hooks/useHardware', () => ({
  useCameras: () => ({
    cameras: [{
      id: 'cam-1',
      brand: 'Tech',
      model: 'A20',
      resolution: '5472×3648',
      sensor_size: '1',
      frame_rate: 9,
      interface: 'GigE',
      shutter_type: null,
      tags: [],
      image_url: null,
      model_3d_url: null,
      front_view_url: null,
      enabled: true,
      created_at: '',
      updated_at: '',
    }, {
      id: 'cam-line',
      brand: 'Hikrobot',
      model: 'MV-CL042-91GC',
      resolution: '4096×2',
      sensor_size: '28.67',
      sensor_width_mm: 28.67,
      sensor_height_mm: 0.014,
      pixel_size_um: 7,
      frame_rate: 9000,
      interface: 'GigE',
      shutter_type: null,
      tags: [],
      image_url: null,
      model_3d_url: null,
      front_view_url: null,
      enabled: true,
      created_at: '',
      updated_at: '',
    }],
  }),
  useLenses: () => ({
    lenses: [{
      id: 'lens-1',
      brand: 'Moritex',
      model: 'MFA110-H25',
      focal_length: '25mm',
      aperture: 'F8',
      mount: 'C',
      compatible_cameras: [],
      tags: [],
      image_url: null,
      front_view_url: null,
      enabled: true,
      resolving_power: null,
      max_sensor_size: '1.1',
      created_at: '',
      updated_at: '',
    }],
  }),
}));

function makeForm(patch: Partial<ModuleFormState> = {}): ModuleFormState {
  return {
    ...getDefaultFormState(),
    type: 'measurement',
    selectedCamera: 'cam-1',
    selectedLens: 'lens-1',
    workingDistance: '730',
    ...patch,
  };
}

function Harness({ initial }: { initial: ModuleFormState }) {
  const [form, setForm] = useState(initial);
  return (
    <>
      <ModuleStep3Imaging form={form} setForm={setForm} />
      <pre data-testid="form-state">
        {JSON.stringify({
          workingDistance: form.workingDistance,
          fieldOfViewWidth: form.fieldOfViewWidth,
          fieldOfViewHeight: form.fieldOfViewHeight,
          fieldOfViewCommon: form.fieldOfViewCommon,
          resolutionPerPixel: form.resolutionPerPixel,
          is3DCamera: form.is3DCamera,
          twoDCameraType: form.twoDCameraType,
          lineScan: form.lineScan,
          selectedLens: form.selectedLens,
          selectedLight: form.selectedLight,
          exposure: form.exposure,
          lightItems: form.lightItems,
        })}
      </pre>
    </>
  );
}

function readState() {
  return JSON.parse(screen.getByTestId('form-state').textContent || '{}') as {
    workingDistance: string;
    fieldOfViewWidth: string;
    fieldOfViewHeight: string;
    fieldOfViewCommon: string;
    resolutionPerPixel: string;
    is3DCamera: boolean;
    twoDCameraType: ModuleFormState['twoDCameraType'];
    lineScan: ModuleFormState['lineScan'];
    selectedLens: string;
    selectedLight: string;
    exposure: string;
    lightItems: unknown[];
  };
}

function Step1Harness({ initial }: { initial: ModuleFormState }) {
  const [form, setForm] = useState(initial);
  return <ModuleStep1Basic form={form} setForm={setForm} />;
}

describe('ModuleStep3Imaging manual FOV behavior', () => {
  it('shows the 3D-only imaging form instead of 2D optical controls', () => {
    render(<Harness initial={makeForm({ is3DCamera: true })} />);

    expect(screen.getByTestId('imaging-3d-camera-toggle')).toBeTruthy();
    expect(screen.getByTestId('three-d-imaging-form')).toBeTruthy();

    expect(screen.getByText('3D 光学方案图信息')).toBeTruthy();
    expect(screen.getByPlaceholderText('LJ-S080')).toBeTruthy();
    expect(screen.getByText('工作距离 WD (mm)')).toBeTruthy();
    expect(screen.getByText('工作距离公差 (±mm)')).toBeTruthy();
    expect(screen.queryByText('检测方式')).toBeNull();
    expect(screen.queryByText('测量步骤')).toBeNull();
    expect(screen.queryByText('视场 FOV (mm)')).toBeNull();
    expect(screen.queryByText('曝光控制')).toBeNull();
    expect(screen.queryByText('光源参数')).toBeNull();
  });

  it('switches to the 3D form from the imaging step and clears 2D optics', async () => {
    render(<Harness initial={makeForm({
      selectedLens: 'lens-1',
      selectedLight: 'light-1',
      workingDistance: '730',
      fieldOfViewWidth: '380',
      fieldOfViewHeight: '253',
      fieldOfViewCommon: '380脳253',
      resolutionPerPixel: '0.0694',
      exposure: '10ms',
      lightItems: [{
        id: 'light-1',
        selectedLight: 'light-1',
        lightMode: 'ring',
        lightAngle: '45',
        lightDistance: '100',
        lightDistanceHorizontal: '20',
        lightDistanceVertical: '98',
        lightNote: 'side',
      }],
    })} />);

    fireEvent.click(within(screen.getByTestId('imaging-3d-camera-toggle')).getByRole('button', { name: '3D 相机' }));

    await waitFor(() => {
      expect(screen.getByTestId('three-d-imaging-form')).toBeTruthy();
      expect(readState()).toMatchObject({
        is3DCamera: true,
        selectedLens: '',
        selectedLight: '',
        workingDistance: '730',
        fieldOfViewWidth: '',
        fieldOfViewHeight: '',
        fieldOfViewCommon: '',
        resolutionPerPixel: '',
        exposure: '',
        lightItems: [],
        lineScan: {
          fieldOfView: '',
          resolutionPerPixel: '',
          scanSpeed: '',
        },
      });
    });
  });

  it('switches back to the 2D imaging form from the imaging step', async () => {
    render(<Harness initial={makeForm({ is3DCamera: true })} />);

    fireEvent.click(within(screen.getByTestId('imaging-3d-camera-toggle')).getByRole('button', { name: '2D 相机' }));

    await waitFor(() => {
      expect(screen.queryByTestId('three-d-imaging-form')).toBeNull();
      expect(readState()).toMatchObject({
        is3DCamera: false,
      });
    });
  });

  it('defaults old 2D data to the unchanged area-scan form', () => {
    const legacy = makeForm();
    render(<Harness initial={legacy} />);

    expect(legacy.twoDCameraType).toBe('area_scan');
    expect(screen.getByTestId('two-d-camera-type-selector')).toBeTruthy();
    expect(screen.queryByTestId('line-scan-imaging-form')).toBeNull();
    expect(screen.getByText('视场 FOV (mm)')).toBeTruthy();
  });

  it('switches between area scan and line scan without clearing either set of values', async () => {
    render(<Harness initial={makeForm({
      fieldOfViewWidth: '380',
      fieldOfViewHeight: '253',
      fieldOfViewCommon: '380×253',
      resolutionPerPixel: '0.0694',
      lineScan: {
        fieldOfView: '50',
        resolutionPerPixel: '0.0122',
        scanSpeed: '500',
      },
    })} />);

    fireEvent.click(screen.getByRole('button', { name: '线扫相机' }));
    await waitFor(() => expect(screen.getByTestId('line-scan-imaging-form')).toBeTruthy());
    expect(readState()).toMatchObject({
      twoDCameraType: 'line_scan',
      fieldOfViewWidth: '380',
      fieldOfViewHeight: '253',
      resolutionPerPixel: '0.0694',
      lineScan: { fieldOfView: '50', resolutionPerPixel: '0.0122', scanSpeed: '500' },
    });

    fireEvent.click(screen.getByRole('button', { name: '面扫相机' }));
    await waitFor(() => expect(screen.queryByTestId('line-scan-imaging-form')).toBeNull());
    expect(readState()).toMatchObject({
      twoDCameraType: 'area_scan',
      fieldOfViewWidth: '380',
      fieldOfViewHeight: '253',
      resolutionPerPixel: '0.0694',
      lineScan: { fieldOfView: '50', resolutionPerPixel: '0.0122', scanSpeed: '500' },
    });
  });

  it('calculates line-scan precision from scalar FOV and the longer resolution axis', async () => {
    render(<Harness initial={makeForm({
      selectedCamera: 'cam-line',
      twoDCameraType: 'line_scan',
      lineScan: { fieldOfView: '50', resolutionPerPixel: '', scanSpeed: '500' },
    })} />);

    expect(screen.queryByPlaceholderText('宽')).toBeNull();
    expect(screen.queryByPlaceholderText('高')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /一键计算/ }));

    await waitFor(() => {
      expect(readState().lineScan).toEqual({
        fieldOfView: '50',
        resolutionPerPixel: '0.0122',
        scanSpeed: '500',
      });
      expect(screen.getByTestId('line-scan-flying-analysis').textContent).toContain('行频');
      expect(screen.getByTestId('line-scan-flying-analysis').textContent).not.toContain('触发频率');
    });
  });

  it('applies the longer-axis sensor FOV to the scalar line-scan field only on request', async () => {
    render(<Harness initial={makeForm({
      selectedCamera: 'cam-line',
      twoDCameraType: 'line_scan',
      fieldOfViewWidth: '380',
      fieldOfViewHeight: '253',
      fieldOfViewCommon: '380×253',
      lineScan: { fieldOfView: '', resolutionPerPixel: '', scanSpeed: '500' },
    })} />);

    expect(readState().lineScan.fieldOfView).toBe('');
    fireEvent.click(screen.getByRole('button', { name: '应用推算FOV' }));

    await waitFor(() => {
      expect(Number(readState().lineScan.fieldOfView)).toBeGreaterThan(0);
      expect(Number(readState().lineScan.resolutionPerPixel)).toBeGreaterThan(0);
      expect(readState()).toMatchObject({
        fieldOfViewWidth: '380',
        fieldOfViewHeight: '253',
        fieldOfViewCommon: '380×253',
      });
    });
  });

  it('does not auto-fill blank FOV or pixel accuracy from WD and hardware', async () => {
    render(<Harness initial={makeForm()} />);

    await waitFor(() => {
      expect(readState()).toMatchObject({
        fieldOfViewWidth: '',
        fieldOfViewHeight: '',
        fieldOfViewCommon: '',
        resolutionPerPixel: '',
      });
    });
  });

  it('keeps FOV blank after the user clears it and changes WD', async () => {
    render(<Harness initial={makeForm({
      fieldOfViewWidth: '380',
      fieldOfViewHeight: '253',
      fieldOfViewCommon: '380×253',
      resolutionPerPixel: '0.0694',
    })} />);

    fireEvent.change(screen.getByDisplayValue('380'), { target: { value: '' } });
    fireEvent.change(screen.getByDisplayValue('730'), { target: { value: '740' } });

    await waitFor(() => {
      expect(readState()).toMatchObject({
        workingDistance: '740',
        fieldOfViewWidth: '',
        resolutionPerPixel: '0.0694',
      });
    });
  });

  it('writes pixel accuracy only after one-click calculation', async () => {
    render(<Harness initial={makeForm({
      fieldOfViewWidth: '380',
      fieldOfViewHeight: '253',
      fieldOfViewCommon: '380×253',
    })} />);

    fireEvent.click(screen.getByRole('button', { name: /一键计算/ }));

    await waitFor(() => {
      expect(readState()).toMatchObject({
        fieldOfViewWidth: '380',
        fieldOfViewHeight: '253',
        resolutionPerPixel: '0.0694',
      });
    });
  });

  it('derives FOV height and pixel accuracy from width after one-click calculation', async () => {
    render(<Harness initial={makeForm({
      fieldOfViewWidth: '380',
    })} />);

    fireEvent.click(screen.getByRole('button', { name: /一键计算/ }));

    await waitFor(() => {
      expect(readState()).toMatchObject({
        fieldOfViewWidth: '380',
        fieldOfViewHeight: '253.33',
        fieldOfViewCommon: '380×253.33',
        resolutionPerPixel: '0.0694',
      });
    });
  });

  it('applies sensor-derived FOV only when the user clicks the apply button', async () => {
    render(<Harness initial={makeForm()} />);

    fireEvent.click(screen.getByRole('button', { name: /应用推算FOV/ }));

    await waitFor(() => {
      expect(readState()).toMatchObject({
        fieldOfViewWidth: '373.76',
        fieldOfViewHeight: '249.17',
        fieldOfViewCommon: '373.76×249.17',
        resolutionPerPixel: '0.0683',
      });
    });
  });
});

describe('line-scan calculation helpers', () => {
  it('uses the longer camera resolution axis', () => {
    expect(getLineScanPixelCount('4096 × 2')).toBe(4096);
    expect(calculateLineScanResolutionPerPixel('50', 'mm', '4096 × 2')).toBe('0.0122');
    expect(calculateLineScanResolutionPerPixel('5', 'cm', '4096 × 2')).toBe('0.0122');
  });

  it('converts line-scan and hidden area-scan FOV values together', () => {
    const converted = convertLineScanDistanceUnit(makeForm({
      distanceUnit: 'mm',
      fieldOfViewWidth: '380',
      fieldOfViewHeight: '250',
      fieldOfViewCommon: '380×250',
      lineScan: { fieldOfView: '50', resolutionPerPixel: '0.0122', scanSpeed: '500' },
    }), 'cm');

    expect(converted).toMatchObject({
      distanceUnit: 'cm',
      fieldOfViewWidth: '38',
      fieldOfViewHeight: '25',
      fieldOfViewCommon: '38×25',
      lineScan: { fieldOfView: '5', resolutionPerPixel: '0.0122', scanSpeed: '500' },
    });
  });

  it('requires positive scalar FOV and scan speed for completion', () => {
    expect(isLineScanConfigComplete({ fieldOfView: '50', resolutionPerPixel: '', scanSpeed: '500' })).toBe(true);
    expect(isLineScanConfigComplete({ fieldOfView: '0', resolutionPerPixel: '', scanSpeed: '500' })).toBe(false);
    expect(isLineScanConfigComplete({ fieldOfView: '50', resolutionPerPixel: '', scanSpeed: '-1' })).toBe(false);
    expect(isLineScanConfigComplete({ fieldOfView: 'abc', resolutionPerPixel: '', scanSpeed: '500' })).toBe(false);
  });
});

describe('active module config precedence', () => {
  it.each([
    ['defect', 'defect_config'],
    ['positioning', 'positioning_config'],
    ['ocr', 'ocr_config'],
    ['deeplearning', 'deep_learning_config'],
    ['measurement', 'measurement_config'],
  ])('loads the %s config before historical residual columns', (type, activeKey) => {
    const module = {
      type,
      defect_config: { marker: 'defect' },
      positioning_config: { marker: 'positioning' },
      ocr_config: { marker: 'ocr' },
      deep_learning_config: { marker: 'deeplearning' },
      measurement_config: { marker: 'measurement' },
    } as Record<string, unknown>;

    expect(getActiveModuleConfig(module)).toBe(module[activeKey]);
  });
});

describe('ModuleStep1Basic camera-specific timing fields', () => {
  it('hides area-scan timing fields for line scan and points to the imaging step', () => {
    render(<Step1Harness initial={makeForm({ twoDCameraType: 'line_scan' })} />);

    expect(screen.queryByText('相机节拍')).toBeNull();
    expect(screen.queryByText('拍照次数')).toBeNull();
    expect(screen.getByTestId('line-scan-step1-hint').textContent).toContain('扫描速度');
  });

  it('keeps the original timing fields for area scan and 3D', () => {
    const { unmount } = render(<Step1Harness initial={makeForm({ twoDCameraType: 'area_scan' })} />);
    expect(screen.getByText('相机节拍')).toBeTruthy();
    expect(screen.getByText('拍照次数')).toBeTruthy();
    unmount();

    render(<Step1Harness initial={makeForm({ is3DCamera: true, twoDCameraType: 'line_scan' })} />);
    expect(screen.getByText('相机节拍')).toBeTruthy();
    expect(screen.getByText('拍照次数')).toBeTruthy();
  });
});
