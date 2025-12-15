import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const devtoolsEventBusPort = Number(process.env.TANSTACK_DEVTOOLS_EVENT_BUS_PORT ?? 42071)

/**
 * Cross-Origin Isolation Plugin
 * Required for WebContainers (SharedArrayBuffer needs COOP/COEP headers)
 * @see https://webcontainers.io/guides/configuring-headers
 */
const crossOriginIsolationPlugin: Plugin = {
  name: 'configure-response-headers',
  configureServer(server) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
      next()
    })
  },
}

const config = defineConfig({
  plugins: [
    crossOriginIsolationPlugin, // Must be first for cross-origin isolation
    devtools({ eventBusConfig: { port: devtoolsEventBusPort } }),
    nitro(),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config

