const test=require('node:test'),assert=require('node:assert/strict'),B=require('../dist/bio.js');
test('标准密码表覆盖 64 个密码子、20 个氨基酸及三个终止密码子',()=>{
  assert.equal(Object.keys(B.code).length,64);assert.equal(new Set(Object.values(B.code).filter(a=>a!=='*')).size,20);
  assert.deepEqual(Object.keys(B.code).filter(c=>B.code[c]==='*').sort(),['TAA','TAG','TGA']);
  assert.equal(B.code.ATG,'M');assert.equal(B.code.TGG,'W');assert.equal(B.code.AGA,'R');
});
test('支持小写、换行和单条 FASTA，拒绝含混输入',()=>{
  assert.equal(B.parse('>demo\natg gct\nTAA'),'ATGGCTTAA');
  for(const s of ['', 'ACNT','ACGU','AC12','>a\nATG\n>b\nGCT','ATG\n>late\nAAA','A'.repeat(6001)]) assert.throws(()=>B.parse(s));
});
test('翻译遇终止停止，GC 和阅读框使用明确约定',()=>{
  const r=B.analyze('ATGGCTTAAGGG');assert.equal(r.protein,'MA');assert.equal(r.codons.length,3);assert.equal(r.gc,50);
  assert.equal(B.analyze('AATGGCTTAA',1).protein,'MA');
  assert.equal(B.analyze('ATGG',0).protein,'M');assert.equal(B.analyze('ATGG').trailing,1);
  assert.equal(B.analyze('TAA').protein,'');assert.equal(B.analyze('A').codons.length,0);
});
test('三个课堂实验得到可手工核对的结果',()=>{
  const a=B.analyze(B.demo);assert.equal(a.protein,'MAEFGWKPYDQVSTRNCHL');
  const silent=B.analyze(B.mutate(B.demo,6,'replace','C'));
  assert.equal(silent.protein,a.protein);assert.equal(B.compare(a,silent,'replace').type,'同义突变');
  const miss=B.analyze(B.mutate(B.demo,8,'replace','C'));
  assert.equal(miss.protein,'MAAFGWKPYDQVSTRNCHL');assert.equal(B.compare(a,miss,'replace').type,'错义突变');
  const stop=B.analyze(B.mutate(B.demo,17,'replace','A'));
  assert.equal(stop.protein,'MAEFG');assert.equal(B.compare(a,stop,'replace').type,'无义突变');
});
test('单碱基增删、终止丢失、未改变以及翻译区外变化',()=>{
  assert.equal(B.mutate('ATG',2,'insert','C'),'ACTG');assert.equal(B.mutate('ATG',2,'delete','A'),'AG');
  assert.throws(()=>B.mutate('ATG',0,'replace','A'));assert.throws(()=>B.mutate('ATG',1.5,'replace','A'));
  assert.equal(B.compare(B.analyze('ATG'),B.analyze('ATG'),'replace').type,'未发生改变');
  assert.equal(B.compare(B.analyze('ATGTAA'),B.analyze('ATGCAA'),'replace').type,'终止丢失');
  assert.equal(B.compare(B.analyze('TAAG'),B.analyze('TAAC'),'replace').type,'翻译区外变化');
  assert.equal(B.analyze(B.mutate('A',1,'delete','T')).protein,'');
});
test('不同氨基酸音高不同，同义突变音高序列相同',()=>{
  assert.equal(new Set(B.pitches).size,20);
  assert.deepEqual(B.analyze('GCT').codons.map(c=>c.midi),B.analyze('GCC').codons.map(c=>c.midi));
  assert.equal(B.analyze('TAA').codons[0].midi,null);
});
test('反向互补和六阅读框 ORF 搜索使用 1-based 坐标',()=>{
  assert.equal(B.reverseComplement('ATGCCCTAA'),'TTAGGGCAT');
  const plus=B.findOrfs('CCCATGAAATAAGGG')[0];
  assert.deepEqual({strand:plus.strand,frame:plus.frame,start:plus.start,end:plus.end,protein:plus.protein,stop:plus.stopCodon},
    {strand:'+',frame:1,start:4,end:12,protein:'MK',stop:'TAA'});
  const minus=B.findOrfs('TTATTTCAT')[0];
  assert.deepEqual({strand:minus.strand,frame:minus.frame,start:minus.start,end:minus.end,protein:minus.protein},
    {strand:'-',frame:1,start:1,end:9,protein:'MK'});
  assert.deepEqual(B.findOrfs('ATGAAAAAA'),[],'不把缺少终止密码子的片段计为完整 ORF');
});
test('突变盲盒候选只包含可判定的单碱基替换',()=>{
  const c=B.mutationCandidates(B.demo,0);
  assert.ok(c.length>0);assert.ok(c.every(x=>['同义突变','错义突变','无义突变'].includes(x.type)));
  assert.ok(c.some(x=>x.type==='同义突变'));assert.ok(c.some(x=>x.type==='错义突变'));assert.ok(c.some(x=>x.type==='无义突变'));
  assert.ok(c.every(x=>x.position>=1&&x.position<=B.demo.length));
});
test('DNA 身份证统计 16 种二核苷酸并生成稳定指纹',()=>{
  const p=B.dinucleotideProfile('AACA');
  assert.equal(p.pairs.length,16);assert.equal(p.total,3);
  assert.deepEqual({AA:p.counts.AA,AC:p.counts.AC,CA:p.counts.CA},{AA:1,AC:1,CA:1});
  assert.equal(Object.values(p.counts).reduce((a,b)=>a+b,0),3);
  assert.equal(p.id,B.sequenceHash('AACA'));assert.match(p.id,/^[0-9A-F]{8}$/);
  assert.ok(p.complexity>=0&&p.complexity<=100);
});
test('进化模拟可复现并保持序列长度',()=>{
  const a=B.simulateEvolution(B.demo,0,8),b=B.simulateEvolution(B.demo,0,8);
  assert.deepEqual(a,b);assert.equal(a.history.length,8);assert.equal(a.finalSequence.length,B.demo.length);
  assert.ok(a.history.every((row,i)=>row.generation===i+1&&row.identity>=0&&row.identity<=100));
  assert.throws(()=>B.simulateEvolution(B.demo,0,21));
});
