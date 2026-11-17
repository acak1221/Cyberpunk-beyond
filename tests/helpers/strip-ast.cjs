// node --expose-internals tests/helpers/strip-ast.cjs <site dir>
// Parses every script of the site before and after stripJs() with the acorn that ships inside Node and compares the
// syntax trees (positions removed). Prints a JSON line; "bad" is the number of scripts whose tree differs.
const fs=require('node:fs'),path=require('node:path');
let acorn;
try{acorn=require('internal/deps/acorn/acorn/dist/acorn')}catch{console.log('NO_ACORN');process.exit(0)}
const site=process.argv[2];
(async()=>{
 const {stripJs}=await import('file:///'+path.join(__dirname,'..','..','scripts','strip.mjs').replace(/\\/g,'/'));
 const tree=src=>JSON.stringify(acorn.parse(src,{ecmaVersion:'latest',sourceType:'script'}),(k,v)=>k==='start'||k==='end'||k==='loc'||k==='range'?undefined:v);
 let files=0,bad=0,total=0,after=0;
 for(const f of fs.readdirSync(site).filter(n=>n.endsWith('.js')).sort()){
  const code=fs.readFileSync(path.join(site,f),'utf8'),out=stripJs(code);
  total+=code.length;after+=out.length;files++;
  let a;try{a=tree(code)}catch{continue} // a script that does not parse is not this test's business (tests/ and check.mjs catch it)
  let b;try{b=tree(out)}catch(e){bad++;console.log('STRIPPED DOES NOT PARSE',f,e.message);continue}
  if(a!==b){bad++;console.log('SYNTAX TREE DIFFERS',f)}
 }
 console.log(JSON.stringify({files,total,after,bad}));
 process.exit(bad?1:0);
})();
