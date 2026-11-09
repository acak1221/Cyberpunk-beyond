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
  const precache=JSON.parse(sw.match(/const PRECACHE = (\[.*\]);/)[1]),version=index.match(/data-build="([0-9a-f]{12})"/)[1];
  // exactly the URLs the page loads, so the first install does not download the bundles a second time
  for(const f of ['./',`nc-red.js?v=${version}`,`nc-red.css?v=${version}`,'manifest.webmanifest'])assert.ok(precache.includes(f),f);
  for(const f of ['index.html','nc-red.js','nc-red.css','vendor/pdfjs/pdf.min.mjs'])assert.ok(!precache.includes(f),f);
  const loaded=[...index.matchAll(/<(?:script|link|img)\b[^>]*?\s(?:src|href)="(?![a-z]+:|#|\/)([^"]+)"/g)].map(m=>m[1]);
  assert.ok(loaded.length>=5&&loaded.includes(`nc-red.js?v=${version}`),loaded.join());
  for(const url of loaded)assert.ok(precache.includes(url),url);
  assert.equal(JSON.parse(sw.match(/const VERSION = (".*?");/)[1]),version);
  assert.ok(JSON.parse(sw.match(/const VIEWS = (\[.*\]);/)[1]).includes('sheet'));
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

test('the PDF reader cache is named after pdf.js alone, so app updates keep it',()=>{
 const copy=fs.mkdtempSync(path.join(os.tmpdir(),'ncred-src-')),outs=[];
 try{
  for(const dir of ['site','scripts'])fs.cpSync(path.join(__dirname,'..',dir),path.join(copy,dir),{recursive:true});
  const stamp=()=>{const out=fs.mkdtempSync(path.join(os.tmpdir(),'ncred-build-'));outs.push(out);execFileSync(process.execPath,[path.join(copy,'scripts','build.mjs'),out],{stdio:'pipe'});const sw=fs.readFileSync(path.join(out,'sw.js'),'utf8');return {app:JSON.parse(sw.match(/const VERSION = (".*?");/)[1]),pdf:JSON.parse(sw.match(/const PDFJS = (\{.*\});/)[1])}};
  const before=stamp();assert.deepEqual(Object.keys(before.pdf.files),['vendor/pdfjs/pdf.min.mjs','vendor/pdfjs/pdf.worker.min.mjs']);
  assert.equal(before.pdf.files['vendor/pdfjs/pdf.min.mjs'],require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(copy,'site','vendor','pdfjs','pdf.min.mjs'))).digest('hex'));
  const index=path.join(copy,'site','index.html');fs.writeFileSync(index,fs.readFileSync(index,'utf8').replace('<meta charset="utf-8">','<meta charset="utf-8"><meta name="x" content="v2">'));
  const update=stamp();assert.notEqual(update.app,before.app);assert.equal(update.pdf.version,before.pdf.version);
  fs.appendFileSync(path.join(copy,'site','vendor','pdfjs','pdf.worker.min.mjs'),'\n');
  assert.notEqual(stamp().pdf.version,before.pdf.version);
 }finally{for(const dir of [copy,...outs])fs.rmSync(dir,{recursive:true,force:true})}
});
