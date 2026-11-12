import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Custom plugin to fix DayJS import issues
const fixDayjsImport = () => {
  return {
    name: 'fix-dayjs-import',
    transform(code) {
      if (code.includes('dayjs')) {
        code = code.replace(
          /import\s+dayjs\s+from\s+['"]dayjs['"]/g,
          'import * as dayjs from "dayjs"'
        )
        code = code.replace(
          /import\s+(\w+)\s+from\s+['"]dayjs\/locale\/(\w+)['"]/g,
          'import * as $1 from "dayjs/locale/$2"'
        )
        code = code.replace(
          /import\s+(\w+)\s+from\s+['"]dayjs\/([^'"]+)['"]/g,
          'import * as $1 from "dayjs/$2"'
        )
      }
      return code
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), fixDayjsImport()],
  resolve: {
    dedupe: ['dayjs', 'react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    modulePreload: {
      polyfill: true,
    },
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('react-router')) {
            return 'vendor-react'
          }
          if (id.includes('@tanstack/react-query')) return 'vendor-query'
          if (id.includes('chart.js') || id.includes('react-chartjs')) return 'vendor-charts'
          if (id.includes('leaflet')) return 'vendor-leaflet'
          if (id.includes('emoji-picker')) return 'vendor-emoji'
          if (id.includes('firebase')) return 'vendor-firebase'
          if (id.includes('@mui') || id.includes('@emotion')) return 'vendor-mui'
          if (id.includes('html2canvas') || id.includes('jspdf')) return 'vendor-pdf'
          if (id.includes('framer-motion')) return 'vendor-motion'
          if (id.includes('axios') || id.includes('date-fns') || id.includes('js-cookie')) {
            return 'vendor-utils'
          }
          return undefined
        },
      },
      plugins: [
        {
          name: 'fix-dayjs-imports',
          transform(code, id) {
            if (id.includes('dayjs') && code.includes('import')) {
              code = code.replace(
                /import\s+(\w+)\s+from\s+['"]dayjs\/locale\/(\w+)['"]/g,
                'import * as $1 from "dayjs/locale/$2"'
              )
              return code
            }
          }
        }
      ]
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    fs: {
      allow: ['..']
    },
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: process.env.API_PROXY_TARGET || 'ws://127.0.0.1:8000',
        ws: true,
        changeOrigin: true,
      },
    }
  },
  esbuild: {
    sourcemap: false,
    drop: command === 'build' ? ['console', 'debugger'] : [],
  },
  css: {
    devSourcemap: false
  },
}))
