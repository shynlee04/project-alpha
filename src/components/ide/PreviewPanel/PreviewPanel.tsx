/**
 * PreviewPanel Component
 * 
 * Displays the running dev server in an iframe with controls for
 * refresh, open in new tab, and device frame selection.
 * 
 * @module components/ide/PreviewPanel
 */

import { useState, useCallback } from 'react';
import { RefreshCw, ExternalLink, Monitor, Tablet, Smartphone } from 'lucide-react';
import { type PreviewPanelProps, type DeviceFrame, DEVICE_FRAMES } from './types';

/**
 * PreviewPanel - Live preview of the running dev server
 * 
 * Features:
 * - Iframe display of dev server URL
 * - Refresh button to reload preview
 * - Open in new tab button
 * - Device frame selector (desktop/tablet/mobile)
 * - Loading and waiting states
 */
export function PreviewPanel({ previewUrl, port }: PreviewPanelProps) {
    const [refreshKey, setRefreshKey] = useState(0);
    const [deviceFrame, setDeviceFrame] = useState<DeviceFrame>('desktop');

    const handleRefresh = useCallback(() => {
        setRefreshKey(prev => prev + 1);
    }, []);

    const handleOpenInNewTab = useCallback(() => {
        if (previewUrl) {
            window.open(previewUrl, '_blank');
        }
    }, [previewUrl]);

    const frameWidth = DEVICE_FRAMES[deviceFrame].width;

    return (
        <div className="h-full flex flex-col border-l border-slate-800">
            {/* Toolbar */}
            <div className="h-9 px-3 flex items-center justify-between border-b border-slate-800/50 bg-slate-900/50">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
                        Preview
                    </span>
                    {port && (
                        <span className="text-xs text-slate-500">
                            :{port}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    {/* Device Frame Selector */}
                    {previewUrl && (
                        <div className="flex items-center gap-0.5 mr-2 border-r border-slate-700 pr-2">
                            {(Object.keys(DEVICE_FRAMES) as DeviceFrame[]).map((frame) => {
                                const Icon = {
                                    desktop: Monitor,
                                    tablet: Tablet,
                                    mobile: Smartphone,
                                }[frame];
                                return (
                                    <button
                                        key={frame}
                                        onClick={() => setDeviceFrame(frame)}
                                        className={`p-1 rounded transition-colors ${deviceFrame === frame
                                            ? 'text-cyan-400 bg-slate-800'
                                            : 'text-slate-500 hover:text-slate-300'
                                            }`}
                                        title={DEVICE_FRAMES[frame].label}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Refresh Button */}
                    <button
                        onClick={handleRefresh}
                        disabled={!previewUrl}
                        className="p-1 text-slate-500 hover:text-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Refresh preview"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>

                    {/* Open in New Tab */}
                    <button
                        onClick={handleOpenInNewTab}
                        disabled={!previewUrl}
                        className="p-1 text-slate-500 hover:text-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Open in new tab"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 flex items-center justify-center bg-slate-950 overflow-auto">
                {previewUrl ? (
                    <div
                        className="h-full transition-all duration-200"
                        style={{
                            width: frameWidth === 'full' ? '100%' : `${frameWidth}px`,
                            maxWidth: '100%',
                        }}
                    >
                        <iframe
                            key={refreshKey}
                            src={previewUrl}
                            className="w-full h-full border-0 bg-white"
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                            title="Preview"
                        />
                    </div>
                ) : (
                    <div className="text-center px-6">
                        <div className="text-slate-500 text-sm mb-2">
                            Waiting for dev server...
                        </div>
                        <div className="text-slate-600 text-xs">
                            Run <code className="px-1.5 py-0.5 bg-slate-800 rounded text-cyan-400">npm run dev</code> in the terminal
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
