import { build as viteBuild } from 'vite';
import { build } from 'esbuild';
await viteBuild();
await build({entryPoints:['electron/main.ts'],bundle:true,platform:'node',format:'esm',target:'node22',outfile:'dist-electron/main.mjs',external:['electron','music-metadata','electron-updater'],sourcemap:true});
await build({entryPoints:['electron/preload.ts'],bundle:true,platform:'node',format:'cjs',target:'node22',outfile:'dist-electron/preload.cjs',external:['electron'],sourcemap:true});
