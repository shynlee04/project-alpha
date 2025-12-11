/**
 * PreviewPanel Types
 * @module components/ide/PreviewPanel/types
 */

/**
 * Device frame options for responsive preview
 */
export type DeviceFrame = 'desktop' | 'tablet' | 'mobile';

/**
 * Device frame configuration with widths
 */
export const DEVICE_FRAMES: Record<DeviceFrame, { label: string; width: number | 'full' }> = {
    desktop: { label: 'Desktop', width: 'full' },
    tablet: { label: 'Tablet', width: 768 },
    mobile: { label: 'Mobile', width: 375 },
};

/**
 * Props for PreviewPanel component
 */
export interface PreviewPanelProps {
    /** URL to display in the preview iframe */
    previewUrl: string | null;
    /** Port number the server is running on */
    port: number | null;
}
