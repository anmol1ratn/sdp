import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      config: 'wrangler.adapter.jsonc',
      platformProxy: {
        configPath: 'wrangler.local.jsonc',
        persist: true
      }
    })
  }
};

export default config;
