import { cloudflare } from '@cloudflare/vite-plugin'
import vue from '@vitejs/plugin-vue'
import * as vueCompiler from '@vue/compiler-sfc'
import { defineConfig, perEnvironmentPlugin } from 'vite'

// The Cloudflare plugin adds a separate Worker environment. The Vue plugin is
// stateful, so create an isolated instance only for the client environment.
// Filtering a shared instance is insufficient because its configuration hooks
// can still reset compiler state while Vite initializes the Worker environment.
const vueClientPlugin = perEnvironmentPlugin('vue-client', (environment) =>
  environment.name === 'client' ? vue({ compiler: vueCompiler }) : false,
)

export default defineConfig({
  plugins: [vueClientPlugin, cloudflare()],
})
