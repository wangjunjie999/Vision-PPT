import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ModuleStep3Imaging } from './ModuleStep3Imaging';
import { getDefaultFormState, type ModuleFormState } from './types';

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
    selectedLens: string;
    selectedLight: string;
    exposure: string;
    lightItems: unknown[];
  };
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

    fireEvent.click(within(screen.getByTestId('imaging-3d-camera-toggle')).getByRole('button'));

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
      });
    });
  });

  it('switches back to the 2D imaging form from the imaging step', async () => {
    render(<Harness initial={makeForm({ is3DCamera: true })} />);

    fireEvent.click(within(screen.getByTestId('imaging-3d-camera-toggle')).getByRole('button'));

    await waitFor(() => {
      expect(screen.queryByTestId('three-d-imaging-form')).toBeNull();
      expect(readState()).toMatchObject({
        is3DCamera: false,
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
