const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const load=()=>import('../scripts/strip.mjs');
const site=path.join(__dirname,'..','site');

test('comments, indentation, trailing blanks and empty lines go; code and line breaks stay',async()=>{
 const {stripJs}=await load();
 const out=stripJs('/* header\n   more */\nconst a = 1;   // one\n\n\n   function f(x) {\n      return x + a; /* inline */\n   }\n');
 assert.equal(out,'const a = 1;\nfunction f(x) {\nreturn x + a;\n}\n');
 assert.equal(stripJs('a /* x */ + /* y */ b'),'a + b\n');
 assert.equal(stripJs('a+/**/+b'),'a+ +b\n','two plus signs never fuse into ++');
 assert.equal(stripJs('x\n'),'x\n');assert.equal(stripJs(''),'\n');
});

test('a line break is never lost: automatic semicolon insertion sees the same program',async()=>{
 const {stripJs}=await load();
 assert.equal(stripJs('return /* a\n b */ 5'),'return\n5\n','a block comment with a line break leaves one');
 assert.equal(stripJs('let a = 1\n  /* c */\n  let b = 2'),'let a = 1\nlet b = 2\n');
 const run=src=>vm.runInNewContext('(function(){'+src+'})()');
 const src='return /* a\n b */ 5';
 assert.equal(run(src),run(stripJs(src)),'undefined before and after');
});

test('strings, template literals and regular expressions are copied untouched',async()=>{
 const {stripJs}=await load();
 const same=code=>assert.equal(stripJs(code),code+'\n',code);
 same('const u = "http://x.test/a//b" + \'/* not a comment */\';');
 same('const t = `line one\n   // kept\n    /* kept */ ${a + b} tail`;');
 same('const r = /[/"\'`]\\//g, q = a / 2 / 3;');
 same('x = a++ / 2 / b;');
 same('s = "a\\\n    b";'); // a line continuation inside a string keeps the next line's blanks
 same('t = `a ${ b ? `c${d}e` : f } g`;');
 same('if (/^\\s*\\/\\//.test(s)) go();');
 // comment-looking text after a template expression is still inside the template
 assert.equal(stripJs('t = `${a /* c */ + 1} // x\n  y`; // z'),'t = `${a + 1} // x\n  y`;\n');
 // a regular expression after a keyword, a division after a closing bracket or a number
 same('return /a\\/b/.test(x);');
 same('const k = (a + b) / 2, m = arr[0] / 3, n = 10 / 5;');
});

test('stripping twice changes nothing more, and the whole app still compiles and shrinks',async()=>{
 const {stripJs}=await load();
 let before=0,after=0;
 for(const f of fs.readdirSync(site).filter(n=>n.endsWith('.js'))){
  const code=fs.readFileSync(path.join(site,f),'utf8'),once=stripJs(code);
  assert.equal(stripJs(once),once,f+' is stable');
  assert.doesNotThrow(()=>new vm.Script(once,{filename:f}),f+' compiles');
  before+=code.length;after+=once.length;
 }
 assert.ok(after<before*0.95,`saved ${(100*(1-after/before)).toFixed(1)}%`);
});

// The proof that only whitespace and comments changed: Node ships acorn, and with --expose-internals a child process
// can parse every script before and after and compare the syntax trees (positions removed; the text of every string,
// template piece and regular expression is part of the tree). Skipped where this Node does not carry acorn.
test('the syntax tree of every script is identical before and after stripping',async()=>{
 const r=spawnSync(process.execPath,['--expose-internals',path.join(__dirname,'helpers','strip-ast.cjs'),site],{encoding:'utf8'});
 if(/NO_ACORN/.test(r.stdout+r.stderr)){console.log('acorn is not available in this Node; syntax tree comparison skipped');return}
 assert.equal(r.status,0,r.stdout+r.stderr);
 assert.match(r.stdout,/"bad":0/);
});
