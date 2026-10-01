import type { Track } from './types';

export interface MusicFolder { path:string; name:string; trackIds:string[]; children:MusicFolder[] }
export function normalizeFolder(value:string):string {
  const path=value.replace(/\\/g,'/').replace(/\/+$/,'');
  return path||'/';
}
const key=(value:string)=>/^[a-z]:/i.test(value)||value.startsWith('//')?value.toLocaleLowerCase():value;
export function folderContains(root:string,folder:string):boolean {
  const parent=key(normalizeFolder(root));const child=key(normalizeFolder(folder));
  return parent===child||child.startsWith(parent==='/'?'/':`${parent}/`);
}
export function trackDirectory(file:string):string {
  const path=file.replace(/\\/g,'/');return normalizeFolder(path.slice(0,path.lastIndexOf('/')));
}
export const folderName=(path:string)=>normalizeFolder(path).split('/').pop()||'/';
export function buildFolderTree(tracks:Track[]):MusicFolder[] {
  const minimalRoots=(paths:string[])=>{
    const roots:string[]=[];
    for(const candidate of [...new Set(paths)].sort((a,b)=>a.length-b.length))if(!roots.some(root=>folderContains(root,candidate)))roots.push(candidate);
    return roots;
  };
  const explicitRoots=minimalRoots(tracks.filter(t=>t.folderRoot&&folderContains(t.folderRoot,trackDirectory(t.path))).map(t=>normalizeFolder(t.folderRoot!)));
  const looseRoots=minimalRoots(tracks.filter(t=>!explicitRoots.some(root=>folderContains(root,trackDirectory(t.path)))).map(t=>trackDirectory(t.path)));
  const tree:MusicFolder[]=[...explicitRoots,...looseRoots].map(path=>({path,name:folderName(path),trackIds:[],children:[]}));
  for(const track of tracks){
    const directory=trackDirectory(track.path);const rootPath=explicitRoots.find(path=>folderContains(path,directory))||looseRoots.find(path=>folderContains(path,directory));
    const root=tree.find(folder=>folder.path===rootPath);if(!root)continue;
    let node:MusicFolder=root;
    node.trackIds.push(track.id);
    const relative=directory.slice(node.path==='/'?1:node.path.length).replace(/^\//,'');
    for(const part of relative.split('/').filter(Boolean)){
      const path=normalizeFolder(`${node.path==='/'?'':node.path}/${part}`);
      let child:MusicFolder|undefined=node.children.find(item=>key(item.path)===key(path));
      if(!child){child={path,name:part,trackIds:[],children:[]};node.children.push(child);}
      child.trackIds.push(track.id);node=child;
    }
  }
  const sort=(nodes:MusicFolder[])=>{nodes.sort((a,b)=>a.name.localeCompare(b.name));for(const node of nodes)sort(node.children);};
  sort(tree);return tree;
}
export function findFolder(nodes:MusicFolder[],path:string|null):MusicFolder|undefined {
  if(!path)return;
  for(const node of nodes){if(key(node.path)===key(normalizeFolder(path)))return node;const found=findFolder(node.children,path);if(found)return found;}
}
