// Render Svelte components on the server so checks can read their HTML without a browser.
import { createServer } from 'vite';
import { render } from 'svelte/server';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export async function withSsr(run) {
  const server = await createServer({ configFile: false, logLevel: 'error', plugins: [svelte({ compilerOptions: { dev: false } })], server: { middlewareMode: true }, appType: 'custom' });
  try {
    const load = path => server.ssrLoadModule(path);
    const html = async (path, props = {}) => render((await load(path)).default, { props }).body;
    return await run({ load, html });
  } finally {
    await server.close();
  }
}
