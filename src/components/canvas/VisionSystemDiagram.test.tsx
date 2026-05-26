import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VisionSystemDiagram } from './VisionSystemDiagram';

describe('VisionSystemDiagram export mode', () => {
  it('renders every light item and controller in the static export card', () => {
    const diagramLightItems = Array.from({ length: 8 }, (_, index) => ({
      id: `light-${index + 1}`,
      label: `LIGHT${index + 1}`,
      light: {
        id: `hardware-light-${index + 1}`,
        brand: 'CST',
        model: `BAR-${index + 1}`,
        color: 'white',
        type: 'bar',
        power: '10W',
        enabled: true,
      } as any,
      position: { x: 240 + index * 12, y: 230 + index * 8 },
      rotation: 0,
      distanceMm: 150 + index,
    }));

    render(
      <VisionSystemDiagram
        camera={null}
        lens={null}
        light={null}
        controller={{
          id: 'controller-1',
          brand: '研华',
          model: 'IPC547G',
          cpu: 'Intel i7-8700',
          memory: '32GB DDR4',
          storage: '1TB HDD',
          gpu: 'NVIDIA Quadro P2000',
          enabled: true,
        } as any}
        interactive={false}
        diagramLightItems={diagramLightItems}
      />,
    );

    diagramLightItems.forEach((item) => {
      expect(
        screen.getByText((content) =>
          content.includes(item.label) && content.includes(item.light.model),
        ),
      ).toBeInTheDocument();
    });
    expect(screen.getByText((content) => content.includes('工控机'))).toBeInTheDocument();
    expect(screen.getByText('Intel i7-8700')).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('研华') && content.includes('IPC547G'))).toBeInTheDocument();
    expect(screen.getByText('GPU: NVIDIA Quadro P2000')).toBeInTheDocument();
    expect(screen.queryByText(/其余|略/)).not.toBeInTheDocument();
  });
});
