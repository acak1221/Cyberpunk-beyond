const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process'),vm=require('node:vm');

function build(){
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'ncred-build-'));
 execFileSync(process.execPath,[path.join(__dirname,'..','scripts','build.mjs'),out],{stdio:'pipe'});
 return out;
}

test('the build bundles every script and stylesheet and precaches the bundles',()=>{
 const out=build();
 try{
  const index=fs.readFileSync(path.join(out,'index.html'),'utf8');
  assert.match(index,/<script src="nc-red\.js\?v=[0-9a-f]{12}"><\/script>/);
  assert.match(index,/<link rel="stylesheet" href="nc-red\.css\?v=[0-9a-f]{12}">/);
  assert.equal((index.match(/<script src=/g)||[]).length,1);
  new vm.Script(fs.readFileSync(path.join(out,'nc-red.js'),'utf8')); // parses as one classic script
  assert.ok(!/@import/.test(fs.readFileSync(path.join(out,'nc-red.css'),'utf8')));
  const sw=fs.readFileSync(path.join(out,'sw.js'),'utf8');
  const precache=JSON.parse(sw.match(/const PRECACHE = (\[.*\]);/)[1]);
  for(const f of ['./','index.html','nc-red.js','nc-red.css','manifest.webmanifest'])assert.ok(precache.includes(f),f);
  assert.ok(!precache.includes('app.js')&&!fs.existsSync(path.join(out,'app.js')));
  const notFound=fs.readFileSync(path.join(out,'404.html'),'utf8');
  assert.match(notFound,/"sheet"/);assert.ok(!notFound.includes('nc-red.js'));
 }finally{fs.rmSync(out,{recursive:true,force:true})}
});

test('the 404 page turns a deep path into the matching hash route under the same base',()=>{
 const out=build();
 try{
  const script=fs.readFileSync(path.join(out,'404.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  const go=(hostname,pathname,search='',hash='')=>{let to=null;const a={href:''};vm.runInNewContext(script,{location:{hostname,pathname,search,hash,replace:u=>{to=u}},document:{querySelector:()=>a}});return to};
  assert.equal(go('me.github.io','/Cyberpunk-beyond/sheet/abc'),'/Cyberpunk-beyond/#/sheet/abc');
  assert.equal(go('me.github.io','/Cyberpunk-beyond/room/K7RQ-M2XA-PZ9E'),'/Cyberpunk-beyond/#/room/K7RQ-M2XA-PZ9E');
  assert.equal(go('example.app','/rules','?x=1'),'/?x=1#/rules');
  assert.equal(go('me.github.io','/Cyberpunk-beyond/missing.png'),'/Cyberpunk-beyond/');
 }finally{fs.rmSync(out,{recursive:true,force:true})}
});

test('every module in the bundle is isolated, so one that throws while loading stops neither the others nor app.js',()=>{
 const out=build();
 try{
  const bundle=fs.readFileSync(path.join(out,'nc-red.js'),'utf8'),scripts=[...fs.readFileSync(path.join(__dirname,'..','site','index.html'),'utf8').matchAll(/<script src="([^":?]+\.js)"><\/script>/g)].map(m=>m[1]);
  for(const f of scripts)assert.ok(bundle.includes(`/* ${f} */\n`+(f==='app.js'?';':'try{\n')),f);
  assert.ok(bundle.trimEnd().endsWith(fs.readFileSync(path.join(__dirname,'..','site','app.js'),'utf8').trimEnd()),'app.js runs last');
 }finally{fs.rmSync(out,{recursive:true,force:true})}
});
