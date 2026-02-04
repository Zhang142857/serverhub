import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    electron([
      {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist/main',
            // 不再将 grpc 相关模块设为 external，让它们被打包进 bundle
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      },
      {
        entry: 'src/preload/index.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist/preload'
          }
        }
      }
    ]),
    renderer(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      imports: ['vue', 'vue-router', 'pinia'],
      dts: 'src/renderer/auto-imports.d.ts'
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/renderer/components.d.ts'
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@main': resolve(__dirname, 'src/main')
    }
  },
  root: '.',
  base: './',
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          'vendor-element': ['element-plus', '@element-plus/icons-vue'],
          'vendor-xterm': ['xterm', 'xterm-addon-fit', 'xterm-addon-web-links']
        }
      }
    }
  }
})
