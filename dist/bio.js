(function (root) {
  'use strict';
  // NCBI translation table 1, codons ordered by T,C,A,G at each position.
  const bases = 'TCAG';
  const amino = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
  const code = {};
  let k = 0;
  for (const a of bases) for (const b of bases) for (const c of bases) code[a+b+c] = amino[k++];
  const alphabet = 'ACDEFGHIKLMNPQRSTVWY';
  // Twenty distinct pitches on a pentatonic scale; an artistic mapping, not a biological property.
  const pitches = alphabet.split('').map((_, i) => 48 + Math.floor(i/5)*12 + [0,2,4,7,9][i%5]);
  const demo = 'ATGGCTGAATTTGGTTGGAAGCCTTACGATCAAGTTTCTACTCGTAATTGCCATCTGTAA';
  function parse(text) {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    const headers = lines.filter(l => l.trim().startsWith('>'));
    if (headers.length > 1) throw Error('每次只分析一条 FASTA 序列，请移除其他记录。');
    if (headers.length && !lines[0].trim().startsWith('>')) throw Error('FASTA 标题必须在序列之前。');
    const sequence = lines.filter(l => !l.trim().startsWith('>')).join('').replace(/\s/g, '').toUpperCase();
    if (!sequence) throw Error('请输入 DNA 序列。');
    if (/[^ACGT]/.test(sequence)) throw Error('仅支持 A、C、G、T；请先处理 N 等模糊碱基，不要输入 RNA 或数字。');
    if (sequence.length > 6000) throw Error('课堂版每次最多分析 6,000 个碱基。');
    return sequence;
  }
  function analyze(sequence, frame = 0) {
    if (![0,1,2].includes(frame)) throw Error('阅读框无效。');
    const codons = [];
    for (let i = frame; i + 2 < sequence.length; i += 3) {
      const triplet = sequence.slice(i,i+3), aa = code[triplet];
      codons.push({triplet, aa, position:i+1, midi: aa === '*' ? null : pitches[alphabet.indexOf(aa)]});
      if (aa === '*') break;
    }
    const counts = Object.fromEntries('ACGT'.split('').map(b => [b, [...sequence].filter(c => c === b).length]));
    return {sequence, frame, codons, protein:codons.filter(c=>c.aa!=='*').map(c=>c.aa).join(''), counts,
      gc: sequence.length ? (counts.G+counts.C)/sequence.length*100 : 0,
      stopped:codons.some(c=>c.aa==='*'), trailing:Math.max(0,sequence.length-frame)%3};
  }
  function mutate(sequence, position, kind, base) {
    if (!Number.isInteger(position) || position < 1 || position > sequence.length) throw Error('突变位置必须是序列范围内的整数（从 1 开始）。');
    const i = position-1;
    if (kind === 'delete') return sequence.slice(0,i)+sequence.slice(i+1);
    if (!/^[ACGT]$/.test(base)) throw Error('请选择有效碱基。');
    if (kind === 'insert') return sequence.slice(0,i)+base+sequence.slice(i);
    if (kind !== 'replace') throw Error('未知突变操作。');
    return sequence.slice(0,i)+base+sequence.slice(i+1);
  }
  function reverseComplement(sequence) {
    const complement = {A:'T', T:'A', C:'G', G:'C'};
    return [...sequence].reverse().map(base => complement[base]).join('');
  }
  function findOrfs(sequence) {
    const orfs = [];
    for (const strand of ['+','-']) {
      const source = strand === '+' ? sequence : reverseComplement(sequence);
      for (let frame = 0; frame < 3; frame++) {
        const starts = [];
        for (let i = frame; i + 2 < source.length; i += 3) {
          const triplet = source.slice(i,i+3);
          if (triplet === 'ATG') starts.push(i);
          if (code[triplet] === '*' && starts.length) {
            for (const startIndex of starts) {
              const translated = analyze(source.slice(startIndex,i+3),0);
              const low = strand === '+' ? startIndex+1 : sequence.length-(i+2);
              const high = strand === '+' ? i+3 : sequence.length-startIndex;
              orfs.push({strand, frame:frame+1, start:low, end:high,
                protein:translated.protein, aaLength:translated.protein.length,
                startCodon:'ATG', stopCodon:triplet});
            }
            starts.length = 0;
          }
        }
      }
    }
    return orfs.sort((a,b)=>b.aaLength-a.aaLength || a.start-b.start);
  }
  function compare(before, after, kind) {
    if (before.sequence === after.sequence) return {type:'未发生改变', detail:'替换碱基与原碱基相同。'};
    if (kind !== 'replace') return {type:'单碱基插入 / 缺失', detail: before.protein === after.protein ? '本次输出的氨基酸序列未改变；变动可能位于所选阅读框之前或首个终止密码子之后。' : '单碱基增减可能引起移码。本次翻译结果已改变，后续三联体会重新分组。'};
    const index = before.codons.findIndex((c,i)=>c.triplet !== after.codons[i]?.triplet);
    if (index < 0) return {type:'翻译区外变化', detail:'变化位于当前分析未翻译的区域。'};
    const a = before.codons[index], b = after.codons[index];
    if (a.aa === b.aa) return {type:a.aa==='*'?'终止密码子保留':'同义突变',detail:`${a.triplet} → ${b.triplet}，${a.aa} 保持不变，因此氨基酸旋律不变。`};
    if (b.aa === '*') return {type:'无义突变',detail:`${a.triplet} → ${b.triplet}，第 ${index+1} 个密码子变为终止信号，旋律提前结束。`};
    if (a.aa === '*') return {type:'终止丢失',detail:`${a.triplet} → ${b.triplet}，原终止信号消失，翻译继续。`};
    return {type:'错义突变',detail:`${a.triplet} → ${b.triplet}，第 ${index+1} 个氨基酸 ${a.aa} → ${b.aa}。`};
  }
  function mutationCandidates(sequence, frame = 0) {
    const original = analyze(sequence,frame), candidates = [];
    for (const [codonIndex,codon] of original.codons.slice(0,120).entries()) {
      if (codon.aa === '*') break;
      for (let offset = 0; offset < 3; offset++) for (const base of 'ACGT') {
        if (base === codon.triplet[offset]) continue;
        const nextCodon = codon.triplet.slice(0,offset)+base+codon.triplet.slice(offset+1);
        const nextAA = code[nextCodon];
        const type = nextAA === codon.aa ? '同义突变' : nextAA === '*' ? '无义突变' : '错义突变';
        const detail = nextAA === codon.aa
          ? `${codon.triplet} → ${nextCodon}，${codon.aa} 保持不变。`
          : nextAA === '*'
            ? `${codon.triplet} → ${nextCodon}，第 ${codonIndex+1} 个密码子变为终止信号。`
            : `${codon.triplet} → ${nextCodon}，第 ${codonIndex+1} 个氨基酸 ${codon.aa} → ${nextAA}。`;
        candidates.push({position:codon.position+offset,from:codon.triplet[offset],to:base,
          type,detail,codonIndex:codonIndex+1,fromCodon:codon.triplet,toCodon:nextCodon});
      }
    }
    return candidates;
  }
  function sequenceHash(sequence) {
    let hash = 2166136261;
    for (const char of sequence) { hash ^= char.charCodeAt(0); hash = Math.imul(hash,16777619); }
    return (hash>>>0).toString(16).padStart(8,'0').toUpperCase();
  }
  function dinucleotideProfile(sequence) {
    const pairs=[];
    for (const a of 'ACGT') for (const b of 'ACGT') pairs.push(a+b);
    const counts=Object.fromEntries(pairs.map(pair=>[pair,0]));
    for (let i=0;i+1<sequence.length;i++) counts[sequence.slice(i,i+2)]++;
    const total=Math.max(0,sequence.length-1);
    const frequencies=Object.fromEntries(pairs.map(pair=>[pair,total?counts[pair]/total:0]));
    const entropy=-Object.values(frequencies).reduce((sum,value)=>sum+(value?value*Math.log2(value):0),0);
    const dominant=[...pairs].sort((a,b)=>counts[b]-counts[a]||a.localeCompare(b))[0];
    return {id:sequenceHash(sequence),pairs,counts,frequencies,total,
      complexity:Math.round(entropy/4*100),dominant,dominantCount:counts[dominant]};
  }
  function proteinIdentity(a,b) {
    const length=Math.max(a.length,b.length);
    if (!length) return 100;
    let matches=0;
    for (let i=0;i<Math.min(a.length,b.length);i++) if (a[i]===b[i]) matches++;
    return matches/length*100;
  }
  function simulateEvolution(sequence, frame=0, generations=8) {
    if (!Number.isInteger(generations)||generations<1||generations>20) throw Error('模拟代数必须是 1–20 的整数。');
    const origin=analyze(sequence,frame), history=[];
    let currentSequence=sequence, seed=parseInt(sequenceHash(sequence),16)^(frame+1)*2654435761;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for (let generation=1;generation<=generations;generation++) {
      const before=analyze(currentSequence,frame);
      const positions=before.codons.filter(c=>c.aa!=='*').flatMap(c=>[c.position,c.position+1,c.position+2]);
      if (!positions.length) break;
      const position=positions[Math.floor(random()*positions.length)], from=currentSequence[position-1];
      const choices=[...'ACGT'].filter(base=>base!==from), to=choices[Math.floor(random()*choices.length)];
      const nextSequence=mutate(currentSequence,position,'replace',to), after=analyze(nextSequence,frame);
      const result=compare(before,after,'replace');
      history.push({generation,position,from,to,type:result.type,detail:result.detail,
        protein:after.protein,identity:Number(proteinIdentity(origin.protein,after.protein).toFixed(1))});
      currentSequence=nextSequence;
    }
    return {seed:sequenceHash(sequence),originalProtein:origin.protein,finalSequence:currentSequence,history};
  }
  const api = {code, alphabet, pitches, demo, parse, analyze, mutate, compare,
    reverseComplement, findOrfs, mutationCandidates, sequenceHash, dinucleotideProfile,
    proteinIdentity, simulateEvolution};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Bio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
