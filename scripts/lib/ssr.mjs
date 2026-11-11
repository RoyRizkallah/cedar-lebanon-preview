// Render Svelte components on the server so checks can read their HTML without a browser.
import { createServer } from 'vite';
import { render } from 'svelte/server';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The project's real path, so a shell started in "d:\Cedar" and one started in "D:\Cedar" load one copy of each module.
const root = realpathSync.native(fileURLToPath(new URL('../..', import.meta.url)));

export async function withSsr(run) {
  const server = await createServer({ root, configFile: false, logLevel: 'error', plugins: [svelte({ compilerOptions: { dev: false } })], server: { middlewareMode: true }, appType: 'custom' });
  try {
    const load = path => server.ssrLoadModule(path);
    const html = async (path, props = {}) => render((await load(path)).default, { props }).body;
    return await run({ load, html });
  } finally {
    await server.close();
  }
}
