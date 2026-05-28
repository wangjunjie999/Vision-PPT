import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  };
}

describe('ModuleStep3Imaging manual FOV behavior', () => {
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
