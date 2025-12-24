import { defineConfig } from 'tsup';

export default defineConfig([
  // Main entry (core + client + memory + embeddings)
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true,
    minify: false,
    external: ['react', 'zod'],
  },
  // React hooks entry
  {
    entry: { react: 'src/react.ts' },
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    treeshake: true,
    minify: false,
    external: ['react', 'zod'],
  },
  // Cloudflare utilities entry
  {
    entry: { cloudflare: 'src/cloudflare.ts' },
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    treeshake: true,
    minify: false,
    external: ['react', 'zod'],
  },
  // Memory entry (standalone)
  {
    entry: { memory: 'src/memory/index.ts' },
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    treeshake: true,
    minify: false,
    external: ['react', 'zod'],
  },
]);
