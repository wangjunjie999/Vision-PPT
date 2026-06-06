import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

  it('wraps long static export card text and grows the card height', () => {
    const { container } = render(
      <VisionSystemDiagram
        camera={{
          id: 'camera-long',
          brand: 'Basler',
          model: 'acA2500-14gm-Very-Long-Model-Name-For-Wrapping',
          resolution: '3200×6400',
          sensor_size: '1/2.5',
          frame_rate: '14',
          pixel_size_um: 2.2,
          sensor_width_mm: 66,
          sensor_height_mm: 78,
          enabled: true,
        } as any}
        lens={{
          id: 'lens-long',
          brand: 'Fujinon',
          model: 'HF16SA-1-Long-Industrial-Lens-Name',
          focal_length: '16mm',
          max_sensor_size: '1.1',
          enabled: true,
        } as any}
        light={null}
        controller={{
          id: 'controller-long',
          brand: '研华',
          model: 'IPC547G-Extended-Industrial-Controller',
          cpu: 'Intel i7-8700 Long CPU Description',
          memory: '32GB DDR4',
          storage: '1TB HDD',
          gpu: 'NVIDIA Quadro P2000 Extra Long GPU Description',
          enabled: true,
        } as any}
        interactive={false}
      />,
    );

    expect(container.textContent).toContain('3200×6400');
    expect(container.textContent).toContain('1/2.5"光学格式');
    expect(container.textContent).toContain('Basler');
    expect(container.textContent).toContain('Very-Long-Model-Name-For-Wrapping');
    expect(container.textContent).toContain('GPU: NVIDIA Quadro P2000');
    expect(container.textContent).toContain('Long GPU Description');

    const cameraCard = container.querySelector('[data-testid="export-card-cam"]');
    const controllerCard = container.querySelector('[data-testid="export-card-controller"]');
    expect(cameraCard?.querySelectorAll('tspan').length).toBeGreaterThan(4);
    expect(controllerCard?.querySelectorAll('tspan').length).toBeGreaterThan(5);
    expect(Number(cameraCard?.querySelector('rect')?.getAttribute('height'))).toBeGreaterThan(80);
    expect(Number(controllerCard?.querySelector('rect')?.getAttribute('height'))).toBeGreaterThan(95);
  });

  it('uses configured working distance tolerance instead of a hardcoded value', () => {
    render(
      <VisionSystemDiagram
        camera={null}
        lens={null}
        light={null}
        interactive={false}
        workingDistanceInput="254"
        workingDistanceMm={254}
        workingDistanceToleranceInput="15"
      />,
    );

    expect(screen.getByText('254±15mm')).toBeInTheDocument();
    expect(screen.queryByText(/±20mm/)).not.toBeInTheDocument();
  });

  it('omits the tolerance marker when working distance tolerance is blank', () => {
    render(
      <VisionSystemDiagram
        camera={null}
        lens={null}
        light={null}
        interactive={false}
        workingDistanceInput="254"
        workingDistanceMm={254}
      />,
    );

    expect(screen.getByText('254mm')).toBeInTheDocument();
    expect(screen.queryByText(/±/)).not.toBeInTheDocument();
  });

  it('keeps raw range text in light distance labels', () => {
    const { container } = render(
      <VisionSystemDiagram
        camera={null}
        lens={null}
        light={null}
        interactive={false}
        diagramLightItems={[{
          id: 'light-range',
          label: 'LIGHT1',
          light: {
            id: 'hardware-light-range',
            brand: 'CST',
            model: 'BAR-RANGE',
            enabled: true,
          } as any,
          position: { x: 240, y: 230 },
          rotation: 0,
          distanceInput: '200~250',
          distanceMm: 225,
        }]}
      />,
    );

    expect(container.textContent).toContain('LIGHT1');
    expect(container.textContent).toContain('200~250mm');
  });

  it('measures a legacy light below the product from the product bottom edge', () => {
    render(
      <VisionSystemDiagram
        camera={null}
        lens={null}
        light={{
          id: 'light-below',
          brand: 'CST',
          model: 'BAR-BELOW',
          color: 'white',
          type: 'bar',
          power: '10W',
          enabled: true,
        } as any}
        interactive={false}
        productPos={{ x: 275, y: 420 }}
        lightPos={{ x: 275, y: 520 }}
      />,
    );

    expect(screen.getByText((content) => content.includes('光源距产品: 82mm'))).toBeInTheDocument();
  });

  it('hides lens and light graphics/cards in 3D mode', () => {
    render(
      <VisionSystemDiagram
        camera={{
          id: 'camera-1',
          brand: 'CameraBrand',
          model: 'CAM-3D',
          resolution: '4000*3000',
          sensor_size: '1/1.7',
          frame_rate: '9',
          enabled: true,
        } as any}
        lens={{
          id: 'lens-1',
          brand: 'LensBrand',
          model: 'LENS-OLD',
          focal_length: '12mm',
          enabled: true,
        } as any}
        light={{
          id: 'light-1',
          brand: 'LightBrand',
          model: 'LIGHT-OLD',
          color: 'white',
          type: 'bar',
          power: '10W',
          enabled: true,
        } as any}
        controller={{
          id: 'controller-1',
          brand: 'IPCBrand',
          model: 'IPC-1',
          cpu: 'Intel i7',
          memory: '16GB',
          storage: '1TB',
          enabled: true,
        } as any}
        interactive={false}
        is3DCamera
        workingDistanceInput="160"
        workingDistanceMm={160}
        workingDistanceToleranceInput="15"
        threeDInfo={{
          model: 'LJ-S080',
          orderModel: '3D-APS-280-N',
          scanLineWidth: '35mm',
          dataPoints: '3200×6400',
          workingDistance: '160mm',
          workingDistanceTolerance: '15mm',
          referenceDistance: null,
          zRange: null,
          xRange: null,
          yRange: null,
          standardRange: null,
          nearRange: null,
          farRange: null,
          xyPrecision: null,
          zPrecision: null,
          mountType: null,
          scanTime: null,
          shotsPerSide: null,
          shotsPerProduct: null,
          detectionSteps: [],
          hasAny: true,
        }}
        diagramLightItems={[{
          id: 'legacy-light',
          label: 'LIGHT1',
          light: {
            id: 'light-legacy',
            brand: 'LegacyLight',
            model: 'LEGACY-LIGHT',
            enabled: true,
          } as any,
          position: { x: 220, y: 230 },
          rotation: 0,
          distanceMm: 180,
        }]}
      />,
    );

    expect(screen.getByText((content) => content.includes('CameraBrand') && content.includes('CAM-3D'))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('IPCBrand') && content.includes('IPC-1'))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('工作距离: 160mm'))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('工作距离公差: ±15mm'))).toBeInTheDocument();
    expect(screen.queryByText((content) => content.includes('LensBrand') || content.includes('LENS-OLD'))).not.toBeInTheDocument();
    expect(screen.queryByText((content) => content.includes('LightBrand') || content.includes('LIGHT-OLD'))).not.toBeInTheDocument();
    expect(screen.queryByText((content) => content.includes('LegacyLight') || content.includes('LIGHT1'))).not.toBeInTheDocument();
  });

  it('renders the product at the controlled vertical position', () => {
    const { container } = render(
      <VisionSystemDiagram
        camera={null}
        lens={null}
        light={null}
        interactive={false}
        productPos={{ x: 275, y: 350 }}
      />,
    );

    const productBody = container.querySelector('[data-testid="diagram-product-body"]');
    expect(productBody).toHaveAttribute('x', '200');
    expect(productBody).toHaveAttribute('y', '350');
  });

  it('keeps product dragging vertical and clamps the diagram bounds', () => {
    const originalCreateSvgPoint = SVGSVGElement.prototype.createSVGPoint;
    const originalGetScreenCTM = SVGSVGElement.prototype.getScreenCTM;
    const originalSetPointerCapture = Element.prototype.setPointerCapture;

    SVGSVGElement.prototype.createSVGPoint = function () {
      return {
        x: 0,
        y: 0,
        matrixTransform() {
          return { x: this.x, y: this.y };
        },
      } as DOMPoint;
    };
    SVGSVGElement.prototype.getScreenCTM = function () {
      return { inverse: () => ({}) } as DOMMatrix;
    };
    Element.prototype.setPointerCapture = vi.fn();

    try {
      const onProductPosChange = vi.fn();
      const { container } = render(
        <VisionSystemDiagram
          camera={null}
          lens={null}
          light={null}
          interactive={true}
          productPos={{ x: 275, y: 420 }}
          onProductPosChange={onProductPosChange}
        />,
      );

      const product = container.querySelector('[data-testid="diagram-product"]');
      expect(product).not.toBeNull();
      fireEvent.pointerDown(product!, { clientX: 275, clientY: 420, pointerId: 1 });
      fireEvent.pointerMove(product!, { clientX: 390, clientY: 100, pointerId: 1 });

      expect(onProductPosChange).toHaveBeenLastCalledWith({ x: 275, y: 300 });
    } finally {
      SVGSVGElement.prototype.createSVGPoint = originalCreateSvgPoint;
      SVGSVGElement.prototype.getScreenCTM = originalGetScreenCTM;
      Element.prototype.setPointerCapture = originalSetPointerCapture;
    }
  });

  it('does not render a dedicated backlight zone hint', () => {
    render(
      <VisionSystemDiagram
        camera={null}
        lens={null}
        light={null}
        interactive={true}
      />,
    );

    expect(screen.queryByText(/背光区/)).not.toBeInTheDocument();
  });

  it('drags multi-light items from the light body', () => {
    const originalCreateSvgPoint = SVGSVGElement.prototype.createSVGPoint;
    const originalGetScreenCTM = SVGSVGElement.prototype.getScreenCTM;
    const originalSetPointerCapture = Element.prototype.setPointerCapture;

    SVGSVGElement.prototype.createSVGPoint = function () {
      return {
        x: 0,
        y: 0,
        matrixTransform() {
          return { x: this.x, y: this.y };
        },
      } as DOMPoint;
    };
    SVGSVGElement.prototype.getScreenCTM = function () {
      return { inverse: () => ({}) } as DOMMatrix;
    };
    Element.prototype.setPointerCapture = vi.fn();

    try {
      const onDiagramLightItemPositionChange = vi.fn();
      const { getByTestId } = render(
        <VisionSystemDiagram
          camera={null}
          lens={null}
          light={null}
          interactive={true}
          diagramLightItems={[{
            id: 'light-1',
            label: 'LIGHT1',
            light: {
              id: 'hardware-light-1',
              brand: 'CST',
              model: 'BAR-1',
              color: 'white',
              type: 'bar',
              power: '10W',
              enabled: true,
            } as any,
            position: { x: 200, y: 220 },
            rotation: 0,
            distanceMm: 150,
          }]}
          onDiagramLightItemPositionChange={onDiagramLightItemPositionChange}
        />,
      );

      const lightBody = getByTestId('diagram-light-light-1');
      fireEvent.pointerDown(lightBody, { clientX: 200, clientY: 220, pointerId: 1 });
      fireEvent.pointerMove(lightBody, { clientX: 215, clientY: 460, pointerId: 1 });

      expect(onDiagramLightItemPositionChange).toHaveBeenLastCalledWith('light-1', { x: 215, y: 460 });
    } finally {
      SVGSVGElement.prototype.createSVGPoint = originalCreateSvgPoint;
      SVGSVGElement.prototype.getScreenCTM = originalGetScreenCTM;
      Element.prototype.setPointerCapture = originalSetPointerCapture;
    }
  });
});
