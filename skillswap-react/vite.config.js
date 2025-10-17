import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})

import { defineConfig } from 'vite';

export default defineConfig({
  // ... other configurations
  build: {
    rollupOptions: {
      external: [
        'fs' // Add 'fs' here
      ]
    }
  }
});
