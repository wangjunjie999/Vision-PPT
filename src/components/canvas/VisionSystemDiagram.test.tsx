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
});
