/**
 * @fileoverview File Icon Utilities
 * Maps file extensions to icon types and provides icon components
 */

import React from 'react';
import {
    File,
    FileCode,
    FileJson,
    FileText,
    FileImage,
    Folder,
    FolderOpen,
    type LucideIcon,
} from 'lucide-react';
import type { FileIconType } from './types';

/**
 * Map of file extensions to icon types
 */
const EXTENSION_TO_ICON: Record<string, FileIconType> = {
    // TypeScript
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.d.ts': 'typescript',

    // JavaScript
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',

    // Styles
    '.css': 'css',
    '.scss': 'css',
    '.sass': 'css',
    '.less': 'css',

    // Data
    '.json': 'json',
    '.yaml': 'json',
    '.yml': 'json',

    // Documentation
    '.md': 'markdown',
    '.mdx': 'markdown',
    '.txt': 'markdown',

    // Web
    '.html': 'html',
    '.htm': 'html',
    '.xml': 'html',
    '.svg': 'html',

    // Images
    '.png': 'image',
    '.jpg': 'image',
    '.jpeg': 'image',
    '.gif': 'image',
    '.webp': 'image',
    '.ico': 'image',
};

/**
 * Map of icon types to Lucide icon components
 */
const ICON_COMPONENTS: Record<FileIconType, LucideIcon> = {
    typescript: FileCode,
    javascript: FileCode,
    css: FileText,
    json: FileJson,
    markdown: FileText,
    html: FileCode,
    image: FileImage,
    folder: Folder,
    'folder-open': FolderOpen,
    default: File,
};

/**
 * Color classes for different icon types
 */
const ICON_COLORS: Record<FileIconType, string> = {
    typescript: 'text-blue-400',
    javascript: 'text-yellow-400',
    css: 'text-pink-400',
    json: 'text-orange-400',
    markdown: 'text-slate-400',
    html: 'text-orange-500',
    image: 'text-purple-400',
    folder: 'text-cyan-400',
    'folder-open': 'text-cyan-300',
    default: 'text-slate-400',
};

/**
 * Get the icon type for a given filename
 * @param filename - The filename to get icon for
 * @param isDirectory - Whether the item is a directory
 * @param isExpanded - Whether directory is expanded (for folders)
 * @returns The icon type
 */
export function getFileIconType(
    filename: string,
    isDirectory: boolean,
    isExpanded: boolean = false
): FileIconType {
    if (isDirectory) {
        return isExpanded ? 'folder-open' : 'folder';
    }

    // Check for exact filename matches first
    const lowerFilename = filename.toLowerCase();
    if (lowerFilename === 'package.json') return 'json';
    if (lowerFilename === 'tsconfig.json') return 'typescript';
    if (lowerFilename === 'readme.md') return 'markdown';

    // Get extension
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) return 'default';

    const ext = filename.slice(lastDotIndex).toLowerCase();
    return EXTENSION_TO_ICON[ext] || 'default';
}

/**
 * Get the Lucide icon component for a file icon type
 * @param iconType - The icon type
 * @returns The Lucide icon component
 */
export function getIconComponent(iconType: FileIconType): LucideIcon {
    return ICON_COMPONENTS[iconType];
}

/**
 * Get the color class for a file icon type
 * @param iconType - The icon type
 * @returns The Tailwind color class
 */
export function getIconColor(iconType: FileIconType): string {
    return ICON_COLORS[iconType];
}

/**
 * Props for the FileIcon component
 */
interface FileIconProps {
    filename: string;
    isDirectory: boolean;
    isExpanded?: boolean;
    className?: string;
    size?: number;
}

/**
 * FileIcon component - renders the appropriate icon for a file/folder
 */
export function FileIcon({
    filename,
    isDirectory,
    isExpanded = false,
    className = '',
    size = 16
}: FileIconProps): React.JSX.Element {
    const iconType = getFileIconType(filename, isDirectory, isExpanded);
    const IconComponent = getIconComponent(iconType);
    const colorClass = getIconColor(iconType);

    return (
        <IconComponent
            size={size}
            className={`${colorClass} ${className} shrink-0`}
        />
    );
}
