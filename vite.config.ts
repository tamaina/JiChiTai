import { cloudflare } from '@cloudflare/vite-plugin'
import vue from '@vitejs/plugin-vue'
import * as vueCompiler from '@vue/compiler-sfc'
import { defineConfig, perEnvironmentPlugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// The Cloudflare plugin adds a separate Worker environment. The Vue plugin is
// stateful, so create an isolated instance only for the client environment.
// Filtering a shared instance is insufficient because its configuration hooks
// can still reset compiler state while Vite initializes the Worker environment.
const vueClientPlugin = perEnvironmentPlugin('vue-client', (environment) =>
  environment.name === 'client' ? vue({ compiler: vueCompiler }) : false,
)

const pwaClientPlugins = VitePWA({
  registerType: 'prompt',
  manifest: {
    id: '/',
    name: 'JiChiTai - 市区町村タイピング',
    short_name: 'JiChiTai',
    description:
      '市区町村の形・市区町村章・市外局番を楽しく覚えるタイピング・学習アプリ',
    lang: 'ja',
    theme_color: '#176b4d',
    background_color: '#f7f7f5',
    display: 'standalone',
    start_url: '/',
    scope: '/',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
    ],
  },
  workbox: {
    navigateFallback: '/index.html',
    globPatterns: ['**/*.{js,css,html,svg,png}'],
    globIgnores: ['**/generated/**/*', 'icon.svg', 'icon-*.png'],
    runtimeCaching: [
      {
        urlPattern: ({ url }) => url.pathname.startsWith('/generated/'),
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'jichitai-generated-data',
          expiration: {
            maxEntries: 3000,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
}).map((plugin) => ({
  ...plugin,
  applyToEnvironment: (environment) => environment.name === 'client',
}))

export default defineConfig({
  plugins: [vueClientPlugin, cloudflare(), ...pwaClientPlugins],
})
