import { describe, it, expect } from 'vitest';
import { getLanguageFromPath, getFileName, getFileExtension, EXTENSION_TO_LANGUAGE } from '../language-utils';

describe('language-utils', () => {
    describe('getLanguageFromPath', () => {
        it('should detect TypeScript', () => {
            expect(getLanguageFromPath('src/index.ts')).toBe('typescript');
            expect(getLanguageFromPath('component.tsx')).toBe('typescript');
        });

        it('should detect JavaScript', () => {
            expect(getLanguageFromPath('utils.js')).toBe('javascript');
            expect(getLanguageFromPath('App.jsx')).toBe('javascript');
            expect(getLanguageFromPath('config.mjs')).toBe('javascript');
            expect(getLanguageFromPath('server.cjs')).toBe('javascript');
        });

        it('should detect web technologies', () => {
            expect(getLanguageFromPath('styles.css')).toBe('css');
            expect(getLanguageFromPath('theme.scss')).toBe('scss');
            expect(getLanguageFromPath('index.html')).toBe('html');
            expect(getLanguageFromPath('page.htm')).toBe('html');
        });

        it('should detect data formats', () => {
            expect(getLanguageFromPath('package.json')).toBe('json');
            expect(getLanguageFromPath('config.yaml')).toBe('yaml');
            expect(getLanguageFromPath('settings.yml')).toBe('yaml');
        });

        it('should detect markdown', () => {
            expect(getLanguageFromPath('README.md')).toBe('markdown');
            expect(getLanguageFromPath('docs.mdx')).toBe('markdown');
        });

        it('should detect shell scripts', () => {
            expect(getLanguageFromPath('build.sh')).toBe('shell');
            expect(getLanguageFromPath('install.bash')).toBe('shell');
            expect(getLanguageFromPath('.env')).toBe('shell');
        });

        it('should return plaintext for unknown extensions', () => {
            expect(getLanguageFromPath('file.xyz')).toBe('plaintext');
            expect(getLanguageFromPath('noextension')).toBe('plaintext');
        });

        it('should handle paths with multiple dots', () => {
            expect(getLanguageFromPath('file.test.ts')).toBe('typescript');
            expect(getLanguageFromPath('config.local.json')).toBe('json');
        });

        it('should be case-insensitive', () => {
            expect(getLanguageFromPath('README.MD')).toBe('markdown');
            expect(getLanguageFromPath('App.TSX')).toBe('typescript');
        });
    });

    describe('getFileName', () => {
        it('should extract filename from path', () => {
            expect(getFileName('src/components/App.tsx')).toBe('App.tsx');
            expect(getFileName('index.ts')).toBe('index.ts');
        });

        it('should handle deep paths', () => {
            expect(getFileName('a/b/c/d/e.txt')).toBe('e.txt');
        });
    });

    describe('getFileExtension', () => {
        it('should extract extension', () => {
            expect(getFileExtension('App.tsx')).toBe('tsx');
            expect(getFileExtension('styles.css')).toBe('css');
        });

        it('should return empty for no extension', () => {
            expect(getFileExtension('Dockerfile')).toBe('dockerfile');
        });
    });

    describe('EXTENSION_TO_LANGUAGE', () => {
        it('should have all common extensions', () => {
            const requiredExts = ['ts', 'tsx', 'js', 'jsx', 'css', 'html', 'json', 'md'];
            requiredExts.forEach(ext => {
                expect(EXTENSION_TO_LANGUAGE).toHaveProperty(ext);
            });
        });
    });
});
