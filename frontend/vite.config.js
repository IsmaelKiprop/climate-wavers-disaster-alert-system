import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Custom plugin to fix DayJS import issues
const fixDayjsImport = () => {
  return {
    name: 'fix-dayjs-import',
    transform(code, id) {
      // Fix DayJS imports
      if (code.includes('dayjs')) {
        // Fix main dayjs import
        code = code.replace(
          /import\s+dayjs\s+from\s+['"]dayjs['"]/g,
          'import * as dayjs from "dayjs"'
        )
        
        // Fix dayjs locale imports
        code = code.replace(
          /import\s+(\w+)\s+from\s+['"]dayjs\/locale\/(\w+)['"]/g,
          'import * as $1 from "dayjs/locale/$2"'
        )
        
        // Fix any other dayjs sub-imports
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
export default defineConfig({
  plugins: [react(), fixDayjsImport()],
  resolve: {
    dedupe: ['dayjs'], // Dedupe dayjs to avoid multiple versions
  },
  optimizeDeps: {
    force: true // Force re-optimization
  },
  build: {
    rollupOptions: {
      external: [],
      plugins: [
        {
          name: 'fix-dayjs-imports',
          transform(code, id) {
            if (id.includes('dayjs') && code.includes('import')) {
              // Fix dayjs locale imports
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
    sourcemap: false, // Disable sourcemaps to reduce warnings
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
    sourcemap: false, // Disable sourcemaps in esbuild
  },
  css: {
    devSourcemap: false // Disable CSS sourcemaps
  },
})
