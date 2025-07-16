import { getSvgPath } from 'figma-squircle';

/**
 * Generate a CSS clip-path for squircle corners
 * @param cornerRadius - The radius of the corners in pixels
 * @param cornerSmoothing - The smoothing factor (0-1, where 1 is most smooth)
 * @param width - Width of the element in pixels
 * @param height - Height of the element in pixels
 * @returns CSS clip-path string
 */
export function generateSquircleClipPath(
  cornerRadius: number = 12,
  cornerSmoothing: number = 0.6,
  width: number = 400,
  height: number = 600
): string {
  try {
    const svgPath = getSvgPath({
      width,
      height,
      cornerRadius,
      cornerSmoothing,
    });
    
    return `path('${svgPath}')`;
  } catch (error) {
    console.warn('Failed to generate squircle clip-path, falling back to border-radius:', error);
    return 'none';
  }
}

/**
 * Generate CSS variables for squircle styling
 * @param cornerRadius - The radius of the corners in pixels
 * @param cornerSmoothing - The smoothing factor (0-1, where 1 is most smooth)
 * @returns CSS custom properties object
 */
export function generateSquircleCSS(
  cornerRadius: number = 12,
  cornerSmoothing: number = 0.6
) {
  return {
    '--squircle-radius': `${cornerRadius}px`,
    '--squircle-smoothing': `${Math.round(cornerSmoothing * 100)}%`,
    'border-radius': `${cornerRadius}px`,
    '-electron-corner-smoothing': `${Math.round(cornerSmoothing * 100)}%`,
  };
}

/**
 * Apply squircle styling to an element
 * @param element - The DOM element to style
 * @param cornerRadius - The radius of the corners in pixels
 * @param cornerSmoothing - The smoothing factor (0-1, where 1 is most smooth)
 */
export function applySquircleStyle(
  element: HTMLElement,
  cornerRadius: number = 12,
  cornerSmoothing: number = 0.6
): void {
  const styles = generateSquircleCSS(cornerRadius, cornerSmoothing);
  
  Object.entries(styles).forEach(([property, value]) => {
    element.style.setProperty(property, value);
  });
  
  // Try to get element dimensions for clip-path
  const rect = element.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    const clipPath = generateSquircleClipPath(
      cornerRadius,
      cornerSmoothing,
      rect.width,
      rect.height
    );
    
    if (clipPath !== 'none') {
      element.style.clipPath = clipPath;
    }
  }
}

/**
 * Create a CSS class for squircle styling
 * @param className - The CSS class name
 * @param cornerRadius - The radius of the corners in pixels
 * @param cornerSmoothing - The smoothing factor (0-1, where 1 is most smooth)
 * @returns CSS string
 */
export function createSquircleCSS(
  className: string,
  cornerRadius: number = 12,
  cornerSmoothing: number = 0.6
): string {
  return `
.${className} {
  border-radius: ${cornerRadius}px;
  -electron-corner-smoothing: ${Math.round(cornerSmoothing * 100)}%;
  /* Fallback for non-Electron environments */
  -webkit-mask-image: radial-gradient(circle at ${cornerRadius}px ${cornerRadius}px, transparent ${cornerRadius}px, black ${cornerRadius}px),
                      radial-gradient(circle at calc(100% - ${cornerRadius}px) ${cornerRadius}px, transparent ${cornerRadius}px, black ${cornerRadius}px),
                      radial-gradient(circle at ${cornerRadius}px calc(100% - ${cornerRadius}px), transparent ${cornerRadius}px, black ${cornerRadius}px),
                      radial-gradient(circle at calc(100% - ${cornerRadius}px) calc(100% - ${cornerRadius}px), transparent ${cornerRadius}px, black ${cornerRadius}px);
  -webkit-mask-size: ${cornerRadius * 2}px ${cornerRadius * 2}px;
  -webkit-mask-position: top left, top right, bottom left, bottom right;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-composite: intersect;
}
`;
}
