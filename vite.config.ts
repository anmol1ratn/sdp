import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin'
};
export default defineConfig({
  server: { headers: isolationHeaders },
  plugins: [
    {
      name: 'isolate-local-speech-workers',
      enforce: 'pre',
      configureServer(server) {
        // SvelteKit serves static assets before Vite's normal header middleware.
        server.middlewares.use((_request, response, next) => {
          for (const [name, value] of Object.entries(isolationHeaders))
            response.setHeader(name, value);
          next();
        });
      }
    },
    tailwindcss(),
    sveltekit()
  ]
});
