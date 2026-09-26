import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',  // rutas relativas: el build funciona en cualquier carpeta/dominio (GitHub Pages, Netlify...)
  plugins: [react()],
  server: { port: 5199, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8765' } },
})
