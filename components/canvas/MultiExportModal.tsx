import React, { useState, useEffect, useMemo } from 'react';
import { X, Download, Check, Square, CheckSquare, Search, Filter, Image as ImageIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { exportImageWithScale } from '../../utils/exportUtils';
import { toast } from 'sonner';
import type { FlowNode } from '../../types/reactFlow';
import { getImageUrl } from '../../utils/imageUtils';

interface MultiExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    nodes: FlowNode[];
    projectName?: string;
}

interface ExportableImage {
    id: string;
    url: string;
    name: string;
    type: string;
}

const FORMAT_OPTIONS = ['PNG', 'JPG'] as const;
type ExportFormat = typeof FORMAT_OPTIONS[number];

export const MultiExportModal: React.FC<MultiExportModalProps> = ({
    isOpen,
    onClose,
    nodes,
    projectName,
}) => {
    const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
    const [exportFormat, setExportFormat] = useState<ExportFormat>('PNG');
    const [searchQuery, setSearchQuery] = useState('');
    const [isExporting, setIsExporting] = useState(false);

    // Extract all exportable images from nodes (Strict filtering for outputs)
    const exportableImages = useMemo(() => {
        const images: ExportableImage[] = [];

        nodes.forEach((node) => {
            let url: string | null = null;
            let name = node.data.label || `${node.type}-${node.id.substring(0, 4)}`;

            // Strict Filter: Only select nodes with explicit result data (Output nodes and processing nodes)
            // This excludes standard ImageNode (inputs), LogoNode, etc.
            const data = node.data as any;
            if (data.resultImageUrl || data.resultImageBase64) {
                url = data.resultImageUrl || (data.resultImageBase64 ? (data.resultImageBase64.startsWith('data:') ? data.resultImageBase64 : `data:image/png;base64,${data.resultImageBase64}`) : null);
            }
            // Explicitly handle 'output' type if it relies on other fields, but OutputNodeData uses resultImageUrl too.
            // If there's any edge case where OutputNode doesn't have result* but should be exported (e.g. connected image), we might need to handle it, but usually it has result data.

            // Name fallback for OutputNode
            if (node.type === 'output' && data.label) {
                name = data.label;
            }

            if (url) {
                images.push({
                    id: node.id,
                    url,
                    name,
                    type: node.type as string,
                });
            }
        });

        return images;
    }, [nodes]);

    // Filter images based on search query
    const filteredImages = useMemo(() => {
        if (!searchQuery) return exportableImages;
        const query = searchQuery.toLowerCase();
        return exportableImages.filter(img =>
            img.name.toLowerCase().includes(query) ||
            img.type.toLowerCase().includes(query)
        );
    }, [exportableImages, searchQuery]);

    // Handle image selection
    const toggleImage = (id: string) => {
        const newSelected = new Set(selectedImages);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedImages(newSelected);
    };

    const selectAll = () => {
        if (selectedImages.size === filteredImages.length) {
            setSelectedImages(new Set());
        } else {
            setSelectedImages(new Set(filteredImages.map(img => img.id)));
        }
    };

    const handleExport = async () => {
        if (selectedImages.size === 0 || isExporting) return;

        setIsExporting(true);
        const selectedList = exportableImages.filter(img => selectedImages.has(img.id));

        try {
            // Try using File System Access API for folder selection
            if ('showDirectoryPicker' in window) {
                try {
                    const dirHandle = await window.showDirectoryPicker();
                    const usedNames = new Set<string>();

                    for (const img of selectedList) {
                        try {
                            // For now we trust the URL is accessible (CORS might be tricky if external, but usually these are internal/R2)
                            // Use helper or fetch directly
                            const response = await fetch(img.url);
                            const blob = await response.blob();

                            // Handle filename uniqueness
                            const safeName = img.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                            let baseFilename = safeName || 'image';
                            const extension = exportFormat.toLowerCase();
                            let filename = `${baseFilename}.${extension}`;

                            let counter = 1;
                            while (usedNames.has(filename)) {
                                filename = `${baseFilename}_${counter}.${extension}`;
                                counter++;
                            }
                            usedNames.add(filename);

                            const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
                            const writable = await fileHandle.createWritable();
                            await writable.write(blob);
                            await writable.close();

                        } catch (err) {
                            console.error(`Failed to save ${img.name}:`, err);
                            toast.error(`Failed to save ${img.name}`);
                        }
                    }
                    toast.success(`${selectedImages.size} image(s) exported successfully!`);
                    onClose();
                    return;

                } catch (err: any) {
                    if (err.name !== 'AbortError') {
                        console.error('Directory selection failed:', err);
                        toast.error('Failed to access folder, falling back to individual downloads');
                    } else {
                        // User cancelled
                        setIsExporting(false);
                        return;
                    }
                }
            }

            // Fallback to individual downloads
            const promises = selectedList.map((img, index) => {
                // Add a small delay between downloads to prevent browser blocking
                return new Promise<void>((resolve) => {
                    setTimeout(async () => {
                        try {
                            await exportImageWithScale(
                                img.url,
                                exportFormat.toLowerCase() as 'png' | 'jpg',
                                1.5,
                                img.name || `image-${index + 1}`
                            );
                        } catch (err) {
                            console.error(`Failed to export ${img.name}:`, err);
                        }
                        resolve();
                    }, index * 200);
                });
            });

            await Promise.all(promises);
            toast.success(`${selectedImages.size} image(s) exported successfully!`);
            onClose();
        } catch (error) {
            console.error('Multi-export error:', error);
            toast.error('Failed to export some images');
        } finally {
            setIsExporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-[#1a1a1a] border border-zinc-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50">
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-100 font-mono flex items-center gap-2">
                            <Download size={20} className="text-[#brand-cyan]" />
                            Export Images
                        </h2>
                        <p className="text-xs text-zinc-500 font-mono mt-1">
                            Select images to download from your project
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-lg transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="px-6 py-4 bg-zinc-900/30 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/50">
                    <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
                            <input
                                type="text"
                                placeholder="Search images..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-xs text-zinc-300 font-mono focus:outline-none focus:ring-1 focus:ring-[#brand-cyan]/50 transition-all"
                            />
                        </div>

                        <button
                            onClick={selectAll}
                            className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-xs text-zinc-300 font-mono hover:bg-zinc-700/50 transition-all whitespace-nowrap"
                        >
                            {selectedImages.size === filteredImages.length && filteredImages.length > 0 ? (
                                <CheckSquare size={14} className="text-[#brand-cyan]" />
                            ) : (
                                <Square size={14} />
                            )}
                            {selectedImages.size === filteredImages.length && filteredImages.length > 0 ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 bg-zinc-800/50 border border-zinc-700/50 p-1 rounded-lg">
                            {FORMAT_OPTIONS.map((format) => (
                                <button
                                    key={format}
                                    onClick={() => setExportFormat(format)}
                                    className={cn(
                                        "px-3 py-1 text-[10px] font-mono rounded transition-all",
                                        exportFormat === format
                                            ? "bg-[#brand-cyan]/20 text-[#brand-cyan] border border-[#brand-cyan]/30"
                                            : "text-zinc-500 hover:text-zinc-300"
                                    )}
                                >
                                    {format}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Grid Gallery */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                    {filteredImages.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {filteredImages.map((img) => (
                                <div
                                    key={img.id}
                                    onClick={() => toggleImage(img.id)}
                                    className={cn(
                                        "group relative aspect-square rounded-xl border transition-all cursor-pointer overflow-hidden",
                                        selectedImages.has(img.id)
                                            ? "border-[#brand-cyan] ring-1 ring-[#brand-cyan]/20"
                                            : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/50"
                                    )}
                                >
                                    <img
                                        src={img.url}
                                        alt={img.name}
                                        className={cn(
                                            "w-full h-full object-cover transition-transform duration-300",
                                            selectedImages.has(img.id) ? "scale-105" : "group-hover:scale-105"
                                        )}
                                    />

                                    {/* Overlay */}
                                    <div className={cn(
                                        "absolute inset-0 transition-opacity flex flex-col justify-between p-2",
                                        selectedImages.has(img.id)
                                            ? "bg-[#brand-cyan]/10"
                                            : "bg-black/0 group-hover:bg-black/40 opacity-0 group-hover:opacity-100"
                                    )}>
                                        <div className="flex justify-end">
                                            <div className={cn(
                                                "w-5 h-5 rounded-full flex items-center justify-center border transition-all",
                                                selectedImages.has(img.id)
                                                    ? "bg-[#brand-cyan] border-[#brand-cyan] text-black"
                                                    : "bg-black/40 border-white/20 text-transparent"
                                            )}>
                                                <Check size={12} strokeWidth={3} />
                                            </div>
                                        </div>

                                        <div className="bg-black/60 backdrop-blur-md rounded-lg p-2 translate-y-1 group-hover:translate-y-0 transition-transform">
                                            <p className="text-[10px] text-zinc-200 font-mono truncate" title={img.name}>
                                                {img.name}
                                            </p>
                                            <p className="text-[8px] text-[#brand-cyan] font-mono uppercase mt-0.5">
                                                {img.type}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-4 py-12">
                            <div className="w-16 h-16 rounded-full bg-zinc-900/50 border border-zinc-800 flex items-center justify-center">
                                <ImageIcon size={32} opacity={0.2} />
                            </div>
                            <p className="text-sm font-mono">
                                {searchQuery ? "No images match your search" : "No exportable images found on the canvas"}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-zinc-800/50 bg-zinc-900/30 flex items-center justify-between">
                    <div className="text-xs font-mono text-zinc-500">
                        {selectedImages.size} of {exportableImages.length} images selected
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={selectedImages.size === 0 || isExporting}
                            className={cn(
                                "px-6 py-2 bg-[#brand-cyan] hover:bg-[#45c3d1] disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-semibold rounded-lg text-xs font-mono transition-all flex items-center gap-2 shadow-lg shadow-[#brand-cyan]/10",
                                isExporting && "animate-pulse"
                            )}
                        >
                            {isExporting ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <Download size={14} />
                                    Export Selected
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
