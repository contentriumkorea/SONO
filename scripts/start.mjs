import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(createRequire(import.meta.url)('electron'),['.'],{stdio:'inherit',env});
child.on('exit',code=>process.exit(code??0));
