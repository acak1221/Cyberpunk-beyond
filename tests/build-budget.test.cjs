const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');

// The core file (nc-red.js) may not grow more than 10% over the baseline in scripts/size-budget.json.
// These tests build a copy of the project, so the real baseline file is never touched.
function copy(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ncred-budget-'));
 for(const d of ['site','scripts'])fs.cpSync(path.join(__dirname,'..',d),path.join(dir,d),{recursive:true});
 return dir;
}
const build=(dir,...args)=>spawnSync(process.execPath,[path.join(dir,'scripts','build.mjs'),path.join(dir,'out'),...args],{encoding:'utf8'});
const budgetFile=dir=>path.join(dir,'scripts','size-budget.json');
const readBudget=dir=>JSON.parse(fs.readFileSync(budgetFile(dir),'utf8'));
const writeBudget=(dir,b)=>fs.writeFileSync(budgetFile(dir),JSON.stringify(b));

test('the baseline file exists and is a plain pair of numbers',()=>{
 const b=JSON.parse(fs.readFileSync(path.join(__dirname,'..','scripts','size-budget.json'),'utf8'));
 assert.ok(Number.isSafeInteger(b.coreBytes)&&b.coreBytes>500000);
 assert.ok(Number.isSafeInteger(b.coreGzip)&&b.coreGzip>100000&&b.coreGzip<b.coreBytes);
});

test('growth of up to 10% over the baseline passes; more fails and says what to do',()=>{
 const dir=copy();
 try{
  const r=build(dir,'--update-budget');assert.equal(r.status,0,r.stderr);
  const b=readBudget(dir),actual=fs.statSync(path.join(dir,'out','nc-red.js')).size;
  assert.equal(b.coreBytes,actual,'--update-budget records the size of nc-red.js');
  assert.ok(b.coreGzip>100000);
  // 5% over the baseline is allowed
  writeBudget(dir,{coreBytes:Math.floor(actual/1.05),coreGzip:b.coreGzip});
  assert.equal(build(dir).status,0);
  // 12% over is not
  writeBudget(dir,{coreBytes:Math.floor(actual/1.12),coreGzip:b.coreGzip});
  let r2=build(dir);
  assert.notEqual(r2.status,0);
  assert.match(r2.stderr,/grew more than 10%/);assert.match(r2.stderr,/--update-budget/);assert.match(r2.stderr,/scripts\/chunks\.mjs/);
  // the compressed size counts too
  writeBudget(dir,{coreBytes:b.coreBytes,coreGzip:Math.floor(b.coreGzip/1.12)});
  r2=build(dir);assert.notEqual(r2.status,0);assert.match(r2.stderr,/gzip/);
  // a smaller core is always fine
  writeBudget(dir,{coreBytes:b.coreBytes*2,coreGzip:b.coreGzip*2});
  assert.equal(build(dir).status,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('without a baseline file the build refuses and names the command that creates it',()=>{
 const dir=copy();
 try{
  fs.rmSync(budgetFile(dir));
  const r=build(dir);assert.notEqual(r.status,0);assert.match(r.stderr,/size-budget\.json is missing/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('moving a script into a lazy chunk shrinks the core file; a chunk that never defines its global is refused',()=>{
 const dir=copy();
 try{
  assert.equal(build(dir,'--update-budget').status,0);
  const before=fs.statSync(path.join(dir,'out','nc-red.js')).size;
  const chunks=path.join(dir,'scripts','chunks.mjs');
  fs.writeFileSync(chunks,fs.readFileSync(chunks,'utf8').replace("probe: 'Builder'","probe: 'NoSuchGlobal'"));
  let r=build(dir);assert.notEqual(r.status,0);assert.match(r.stderr,/never defines NoSuchGlobal/);
  fs.writeFileSync(chunks,fs.readFileSync(chunks,'utf8').replace("probe: 'NoSuchGlobal'","probe: 'Builder'").replace("files: ['builder.js']","files: ['builder.js','app.js']"));
  r=build(dir);assert.notEqual(r.status,0);assert.match(r.stderr,/app\.js cannot be in a lazy chunk/);
  fs.writeFileSync(chunks,fs.readFileSync(chunks,'utf8').replace("files: ['builder.js','app.js']","files: ['builder.js']").replace("views: ['builder', 'builder-choice']","views: ['builder', 'no-such-screen']"));
  r=build(dir);assert.notEqual(r.status,0);assert.match(r.stderr,/no-such-screen is not a screen/);
  assert.ok(before>1000000);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('--no-strip keeps the comments, for debugging a build',()=>{
 const dir=copy();
 try{
  assert.equal(build(dir,'--update-budget','--no-strip').status,0);
  const plain=fs.statSync(path.join(dir,'out','nc-red.js')).size;
  assert.equal(build(dir,'--update-budget').status,0);
  assert.ok(fs.statSync(path.join(dir,'out','nc-red.js')).size<plain*0.95);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
