import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { readState, writeState } from '../electron/store';
const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir,{recursive:true,force:true}); });
async function target() { const dir=await mkdtemp(path.join(tmpdir(),'luma-test-')); dirs.push(dir); return path.join(dir,'state.json'); }
it('persists actual state through disk and recovers last valid backup', async () => {
  const file=await target();
  const initial=await readState(file);
  initial.state.settings.volume=0.33;
  await writeState(file,initial.state);
  initial.state.settings.volume=0.66;
  await writeState(file,initial.state);
  expect((await readState(file)).state.settings.volume).toBe(0.66);
  await writeFile(file,'{broken');
  const restored=await readState(file);
  expect(restored.state.settings.volume).toBe(0.33);
  expect(restored.warning).toBeTruthy();
  expect(await readFile(file,'utf8')).toBe('{broken');
});
