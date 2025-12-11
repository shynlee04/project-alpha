/**
 * Language detection utility for Monaco Editor
 * Maps file extensions to Monaco language identifiers
 * @module lib/editor/language-utils
 */

/**
 * Map of file extensions to Monaco language identifiers
 */
export const EXTENSION_TO_LANGUAGE: Record<string, string> = {
    // TypeScript/JavaScript
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',

    // Web technologies
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    htm: 'html',
    xml: 'xml',
    svg: 'xml',

    // Data formats
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'ini',

    // Documentation
    md: 'markdown',
    mdx: 'markdown',

    // Shell/Config
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    env: 'shell',

    // Other
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    sql: 'sql',
    graphql: 'graphql',
    gql: 'graphql',
};

/**
 * Get Monaco language identifier from file path
 * @param filePath - The file path (e.g., "src/index.ts")
 * @returns Monaco language identifier (e.g., "typescript")
 */
export function getLanguageFromPath(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    return EXTENSION_TO_LANGUAGE[ext] ?? 'plaintext';
}

/**
 * Get file extension from path
 * @param filePath - The file path
 * @returns File extension without dot (e.g., "ts")
 */
export function getFileExtension(filePath: string): string {
    return filePath.split('.').pop()?.toLowerCase() ?? '';
}

/**
 * Get filename from path
 * @param filePath - The file path (e.g., "src/components/App.tsx")
 * @returns Filename (e.g., "App.tsx")
 */
export function getFileName(filePath: string): string {
    return filePath.split('/').pop() ?? filePath;
}
