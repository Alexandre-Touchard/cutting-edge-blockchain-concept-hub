import { createServer } from 'vite';

// Vercel dev starts the framework dev command on an internal port and expects the framework
// to bind to that exact port so it can proxy everything on http://localhost:<listen>/.
// We enforce it by using Vite's JS API (avoids Windows .cmd spawn issues and avoids bin paths).
const port =
  Number(
    process.env.PORT ||
      process.env.VERCEL_DEV_PORT ||
      process.env.VERCEL_PORT ||
      process.env.VERCEL_INTERNAL_PORT ||
      ''
  ) || 5173;

const server = await createServer({
  clearScreen: false,
  server: {
    port,
    strictPort: true
  }
});

await server.listen();
server.printUrls();
server.bindCLIShortcuts?.({ print: true });

// Keep the process alive.
await new Promise(() => {});
