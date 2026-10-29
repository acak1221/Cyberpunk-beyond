import { fileURLToPath } from 'node:url';

const vercelRuntime = fileURLToPath(new URL('./lib/platform-vercel.ts', import.meta.url));
const vercelGameGuard = fileURLToPath(new URL('./lib/game-guard-vercel.ts', import.meta.url));

// Sites builds with vinext/Vite and imports the default Cloudflare runtime.
// Vercel builds with Next.js and substitutes the server-only Supabase runtime.
export default {
  async rewrites() {
    return [{ source: '/signin-with-chatgpt', destination: '/auth/signin' }];
  },
  webpack(config, { webpack }) {
    config.resolve.alias['@platform-runtime$'] = vercelRuntime;
    config.resolve.alias['@game-guard$'] = vercelGameGuard;
    // Next's TS path resolver runs ahead of ordinary aliases in some builds;
    // replace the request before resolution so Cloudflare is never bundled.
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^@platform-runtime$/, vercelRuntime));
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^@game-guard$/, vercelGameGuard));
    return config;
  },
  turbopack: {
    resolveAlias: { '@platform-runtime': './lib/platform-vercel.ts', '@game-guard': './lib/game-guard-vercel.ts' },
  },
};
