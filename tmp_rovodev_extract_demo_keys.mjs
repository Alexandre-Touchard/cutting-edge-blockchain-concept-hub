import fs from 'node:fs';
function djb2Hash(input){let hash=5381;for(let i=0;i<input.length;i++)hash=(hash*33)^input.charCodeAt(i);return (hash>>>0).toString(36)}
function normalizeKeyFragment(s){return s.toLowerCase().replace(/\s+/g,' ').trim().slice(0,40).replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,'_')}
function makeAutoKey(demoId, english){return `demos.${demoId}.auto.${normalizeKeyFragment(english)}_${djb2Hash(english)}`;}
const [,,filePath,demoId]=process.argv; if(!filePath||!demoId){console.error('usage: node tmp_rovodev_extract_demo_keys.mjs <file> <demoId>');process.exit(1)}
const src=fs.readFileSync(filePath,'utf8');
const regexes=[/\btr\(\s*'([^']+)'\s*(?:,\s*\{[^}]*\})?\s*\)/g,/\btr\(\s*\"([^\"]+)\"\s*(?:,\s*\{[^}]*\})?\s*\)/g];
const strings=new Set(); for(const re of regexes){let m; while((m=re.exec(src))) strings.add(m[1]);}
const out={}; for(const s of [...strings].sort()) out[makeAutoKey(demoId,s)]=s; process.stdout.write(JSON.stringify(out,null,2));
