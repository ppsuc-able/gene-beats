'use strict';
const $ = id => document.getElementById(id);
let original, variant, mutationRecord = null, audioContext, sources = [], timers = [], playRun = 0;
let challenge = null, challengePoints = 0, challengeStreak = 0, evolution = null;
const colors = {A:'#a4f5c0', C:'#8abaff', G:'#efbd73', T:'#d79ce7'};
function stop() {
  playRun++;
  sources.forEach(s => { try { s.stop(); } catch (_) {} });
  sources = []; timers.forEach(clearTimeout); timers = [];
  document.querySelectorAll('.active').forEach(n=>n.classList.remove('active'));
  $('audio-status').textContent = '播放已停止。可选择另一条序列进行比较。';
}
function score(id, result, reference) {
  const el = $(id); el.replaceChildren(); el.classList.remove('empty');
  el.classList.toggle('variant-track', !!reference);
  result.codons.slice(0,120).forEach((c,i)=>{
    const note = document.createElement('div'); note.className = 'note';
    if (reference && reference.codons[i]?.triplet !== c.triplet) note.classList.add('changed');
    note.title = `第 ${i+1} 个密码子，碱基 ${c.position}–${c.position+2}：${c.triplet} → ${c.aa === '*' ? '终止' : c.aa}`;
    const space = document.createElement('div'); space.className='bar-space';
    const bar = document.createElement('div'); bar.className='bar'; bar.style.height = c.midi === null ? '3px' : `${12+(c.midi-48)*.9}px`;
    space.append(bar); note.append(space);
    for (const [cls,text] of [['aa',c.aa === '*' ? 'STOP' : c.aa],['triplet',c.triplet],['pos',String(c.position)]]) {
      const span = document.createElement('span'); span.className = cls; span.textContent = text; note.append(span);
    }
    el.append(note);
  });
  if (!result.codons.length) {el.textContent='该阅读框没有完整密码子。';el.classList.add('empty');}
}
function effect(title, detail) {
  $('effect').replaceChildren();
  const strong = document.createElement('strong'), p = document.createElement('p');
  strong.textContent=title; p.textContent=detail; $('effect').append(strong,p);
}
function showVariant(result, record) {
  variant=result; mutationRecord=record;
  score('variant-score',variant,original);
  effect(record.type,record.detail);
  $('variant-info').textContent=`${variant.protein.length} aa · 黄色标出改变的密码子`;
  $('play-variant').disabled=!variant.protein.length;
}
function renderOrfs() {
  const radar=$('orf-radar'), summary=$('orf-summary');
  radar.replaceChildren(); summary.replaceChildren();
  if (!original) { summary.textContent='输入有效 DNA 后才能扫描。'; return; }
  const orfs=Bio.findOrfs(original.sequence), longest=orfs[0], max=Math.max(1,...orfs.map(o=>o.aaLength));
  for (const strand of ['+','-']) for (let frame=1;frame<=3;frame++) {
    const best=orfs.find(o=>o.strand===strand&&o.frame===frame);
    const card=document.createElement('article'); card.className=`orf-frame ${strand==='-'?'reverse':''}`;
    const head=document.createElement('header'), label=document.createElement('span'), length=document.createElement('small');
    label.textContent=`${strand}${frame}`; length.textContent=best?`${best.aaLength} aa`:'无完整 ORF'; head.append(label,length);
    const track=document.createElement('div'), fill=document.createElement('span'); track.className='orf-track';
    fill.style.width=best?`${Math.max(4,best.aaLength/max*100)}%`:'0'; track.append(fill);
    const detail=document.createElement('p'); detail.textContent=best?`坐标 ${best.start}–${best.end} · ${best.stopCodon}`:'没有 ATG → 同框终止';
    card.append(head,track,detail); radar.append(card);
  }
  const strong=document.createElement('strong'), p=document.createElement('p');
  if (longest) {
    strong.textContent=`最长完整 ORF：${longest.strand}${longest.frame} · ${longest.aaLength} aa`;
    p.textContent=`原序列坐标 ${longest.start}–${longest.end}，起始 ATG，终止 ${longest.stopCodon}。共找到 ${orfs.length} 个完整 ORF。`;
    const playOrf=document.createElement('button'); playOrf.id='play-orf'; playOrf.className='secondary orf-play'; playOrf.textContent='♫ 播放最长 ORF';
    playOrf.onclick=()=>playOrfResult(longest); summary.append(strong,p,playOrf); return orfs;
  } else {
    strong.textContent='没有找到完整 ORF';
    p.textContent='当前序列中没有“ATG 开始、同阅读框终止”的完整片段；短序列出现这种结果很常见。';
  }
  summary.append(strong,p);
  return orfs;
}
function playOrfResult(orf) {
  const source=orf.strand==='+'?original.sequence:Bio.reverseComplement(original.sequence);
  const start=orf.strand==='+'?orf.start-1:original.sequence.length-orf.end;
  const result=Bio.analyze(source.slice(start,start+(orf.end-orf.start+1)),0);
  play('orf',result,`最长 ORF ${orf.strand}${orf.frame}`);
}
function renderIdentity() {
  const profile=Bio.dinucleotideProfile(original.sequence), heat=$('dna-heatmap');
  heat.replaceChildren();
  const corner=document.createElement('span'); corner.className='heat-label'; heat.append(corner);
  for (const b of 'ACGT') {const label=document.createElement('span');label.className='heat-label';label.textContent=b;heat.append(label);}
  const max=Math.max(1,...Object.values(profile.counts));
  for (const a of 'ACGT') {
    const label=document.createElement('span');label.className='heat-label';label.textContent=a;heat.append(label);
    for (const b of 'ACGT') {
      const pair=a+b, cell=document.createElement('span'), count=profile.counts[pair];
      cell.className='heat-cell';cell.textContent=count;cell.title=`${pair}: ${count} 次`;
      cell.style.background=`color-mix(in srgb, var(--mint) ${Math.max(8,count/max*100)}%, #172638)`;
      cell.style.color=count/max>.48?'#082016':'var(--text)';heat.append(cell);
    }
  }
  $('sequence-id').textContent=profile.id; $('sequence-complexity').textContent=`${profile.complexity}/100`;
  $('sequence-dominant').textContent=`${profile.dominant} · ${profile.dominantCount} 次`;
  $('copy-sequence-id').dataset.id=profile.id;
}
function runEvolution() {
  if (!original) return;
  const generations=Number($('generations').value);
  evolution=Bio.simulateEvolution(original.sequence,original.frame,generations);
  const chart=$('evolution-chart');chart.replaceChildren();chart.style.gridTemplateColumns=`repeat(${Math.max(1,evolution.history.length)},1fr)`;
  for (const row of evolution.history) {
    const bar=document.createElement('div');bar.className='evolution-bar';
    const value=document.createElement('span'), fill=document.createElement('i'), label=document.createElement('small');
    value.textContent=`${row.identity}%`;fill.style.height=`${Math.max(4,row.identity)}%`;label.textContent=`G${row.generation}`;
    bar.append(value,fill,label);bar.title=`第 ${row.generation} 代：${row.position} 位 ${row.from}→${row.to}，${row.type}`;chart.append(bar);
  }
  const last=evolution.history.at(-1);
  $('evolution-summary').textContent=last?`第 ${generations} 代：蛋白质身份保持率 ${last.identity}%，最后一次变化是${last.type}。相同序列与相同代数会得到相同结果。`:'当前序列没有可模拟的已翻译密码子。';
}
function resetChallengeCard() {
  challenge=null;
  $('challenge-card').replaceChildren();
  const icon=document.createElement('span'), text=document.createElement('p'); icon.textContent='?';text.textContent='等待抽取';$('challenge-card').append(icon,text);
  $('challenge-result').textContent='答对得 10 分，连胜还有加成。';
  document.querySelectorAll('[data-guess]').forEach(b=>{b.disabled=true;b.classList.remove('correct','wrong');});
}
function drawChallenge() {
  if (!original && !analyze()) return;
  const candidates=Bio.mutationCandidates(original.sequence,original.frame);
  if (!candidates.length) {$('challenge-result').textContent='当前阅读框没有可出题的已翻译密码子。';return;}
  challenge=candidates[Math.floor(Math.random()*candidates.length)];
  const card=$('challenge-card');card.replaceChildren();
  const icon=document.createElement('span'), text=document.createElement('p'), title=document.createElement('strong');
  icon.textContent='?'; title.textContent=`第 ${challenge.position} 位：${challenge.from} → ${challenge.to}`;
  text.append(title,document.createTextNode(`阅读框 +${original.frame+1} · 第 ${challenge.codonIndex} 个密码子`));card.append(icon,text);
  $('challenge-result').textContent='它会造成哪一种变化？先猜再揭晓。';
  document.querySelectorAll('[data-guess]').forEach(b=>{b.disabled=false;b.classList.remove('correct','wrong');});
}
function answerChallenge(button) {
  if (!challenge) return;
  const correct=button.dataset.guess===challenge.type;
  if (correct) {challengeStreak++;challengePoints+=10+Math.max(0,challengeStreak-1)*2;} else challengeStreak=0;
  $('challenge-score').textContent=`${challengePoints} 分 · ${challengeStreak} 连胜`;
  document.querySelectorAll('[data-guess]').forEach(b=>{
    b.disabled=true;
    if (b.dataset.guess===challenge.type) b.classList.add('correct');
    else if (b===button) b.classList.add('wrong');
  });
  const sequence=Bio.mutate(original.sequence,challenge.position,'replace',challenge.to);
  const result=Bio.analyze(sequence,original.frame);
  const record={position:challenge.position,kind:'replace',base:challenge.to,type:challenge.type,detail:challenge.detail};
  showVariant(result,record);
  $('kind').value='replace';$('base').disabled=false;$('position').value=challenge.position;$('base').value=challenge.to;
  $('challenge-result').textContent=`${correct?'答对了！':'这次没猜中。'} ${challenge.type}：${challenge.detail}`;
  challenge=null;
}
function analyze() {
  stop();
  try {
    original = Bio.analyze(Bio.parse($('sequence').value), Number($('frame').value));
    variant = null; mutationRecord = null; $('error').textContent = '';
    $('stats').innerHTML = `<div><strong>${original.sequence.length}</strong><span>碱基 bp</span></div><div><strong>${original.gc.toFixed(1)}%</strong><span>GC 含量</span></div><div><strong>${original.protein.length}</strong><span>氨基酸 aa</span></div>`;
    $('composition').replaceChildren();
    for (const b of 'ACGT') { const part=document.createElement('span'); part.style.width=`${original.counts[b]/original.sequence.length*100}%`; part.style.background=colors[b]; $('composition').append(part); }
    $('composition-label').textContent = 'ACGT'.split('').map(b=>`${b} ${original.counts[b]}`).join('  ·  ');
    score('original-score', original);
    $('original-info').textContent = `${original.protein.length} aa · 阅读框 +${original.frame+1}`;
    $('variant-info').textContent = '尚未突变'; $('variant-score').textContent='选择上方实验，看看哪些密码子变了。'; $('variant-score').className='score empty';
    $('play-original').disabled = !original.protein.length; $('play-variant').disabled = true;
    $('position').max=original.sequence.length;
    $('translation-note').textContent = `从所选位置直接查表，不要求以 ATG 开始。${original.stopped?'已遇到首个终止密码子，后面的碱基不翻译。':`未遇到终止密码子；末尾不足三位的 ${original.trailing} 个碱基不翻译。`}图谱和播放最多展示前 120 个密码子，导出包含完整分析。`;
    effect('等待你的第一个实验','每次突变均以左侧已分析的原始序列为基准。');
    renderOrfs(); renderIdentity(); resetChallengeCard(); evolution=null; $('evolution-chart').replaceChildren(); $('evolution-summary').textContent='点击开始，查看每一代的氨基酸身份保持率。';
    return true;
  } catch(e) {
    original=null; variant=null; mutationRecord=null; $('error').textContent=e.message;
    $('stats').replaceChildren(); $('composition').replaceChildren(); $('composition-label').textContent='';
    for (const id of ['original-score','variant-score']) {$(id).textContent='请修正输入后重新分析。';$(id).className='score empty';}
    $('play-original').disabled=true; $('play-variant').disabled=true;
    $('original-info').textContent='输入无效'; $('variant-info').textContent=''; $('translation-note').textContent='';
    $('orf-radar').replaceChildren(); $('orf-summary').textContent='请修正输入后重新扫描。'; resetChallengeCard();
    $('dna-heatmap').replaceChildren(); $('sequence-id').textContent='--------'; $('sequence-complexity').textContent='--'; $('sequence-dominant').textContent='--';
    effect('尚无有效分析','请先修正左侧序列。'); return false;
  }
}
function applyMutation() {
  if (!analyze()) return;
  try {
    const position=Number($('position').value),kind=$('kind').value,base=$('base').value;
    const sequence=Bio.mutate(original.sequence,position,kind,base);
    if (sequence.length>6000) throw Error('插入后超过 6,000 个碱基，请缩短原始序列。');
    const result=Bio.analyze(sequence,original.frame), comparison=Bio.compare(original,result,kind);
    showVariant(result,{position,kind,base:kind==='delete'?null:base,...comparison});
  } catch(e) { $('error').textContent=e.message; }
}
async function play(which, overrideResult=null, overrideLabel='') {
  stop(); const run=playRun, result=overrideResult||(which==='original'?original:variant), target=$(which==='original'?'original-score':which==='variant'?'variant-score':'');
  if (!result || !result.protein.length) return;
  try {
    const Audio=window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw Error('浏览器不支持 Web Audio，请使用新版 Chrome 或 Edge。');
    audioContext ||= new Audio(); await audioContext.resume();
    if (run!==playRun) return;
    const duration=60/Number($('tempo').value), start=audioContext.currentTime+.08;
    const notes=result.codons.slice(0,120).filter(c=>c.aa!=='*');
    notes.forEach((c,i)=>{
      const osc=audioContext.createOscillator(), gain=audioContext.createGain(), at=start+i*duration;
      osc.type='sine'; osc.frequency.value=440*2**((c.midi-69)/12);
      gain.gain.setValueAtTime(0,at); gain.gain.linearRampToValueAtTime(.15,at+.02); gain.gain.exponentialRampToValueAtTime(.001,at+duration*.86);
      osc.connect(gain);gain.connect(audioContext.destination);osc.onended=()=>{osc.disconnect();gain.disconnect();};osc.start(at);osc.stop(at+duration*.9);sources.push(osc);
      timers.push(setTimeout(()=>{
        document.querySelectorAll('.active').forEach(n=>n.classList.remove('active'));
        const n=target?.children[i]; n?.classList.add('active');
        if(n&&target) target.scrollLeft=Math.max(0,n.offsetLeft-target.offsetLeft-120);
        const label=overrideLabel||(which==='original'?'原始': '突变');
        $('audio-status').textContent=`正在播放${label}：第 ${i+1} 个氨基酸 ${c.aa}，密码子 ${c.triplet}。`;
      },80+i*duration*1000));
    });
    timers.push(setTimeout(()=>{stop();$('audio-status').textContent='播放结束。试着比较另一条序列。';},100+notes.length*duration*1000));
  } catch(e) {stop();$('audio-status').textContent=e.message;}
}
$('sequence').value=Bio.demo;
$('analyze').onclick=analyze;
$('reset').onclick=()=>{$('sequence').value=Bio.demo;$('frame').value='0';analyze();};
$('sequence').addEventListener('input',analyze);
$('frame').onchange=analyze;
$('mutate').onclick=applyMutation;
$('scan-orfs').onclick=renderOrfs;
$('draw-challenge').onclick=drawChallenge;
document.querySelectorAll('[data-guess]').forEach(b=>b.onclick=()=>answerChallenge(b));
$('run-evolution').onclick=runEvolution;
$('generations').oninput=()=>{$('generations-value').textContent=$('generations').value;};
$('copy-sequence-id').onclick=async()=>{
  const id=$('copy-sequence-id').dataset.id;if(!id)return;
  try {await navigator.clipboard.writeText(id);$('copy-sequence-id').textContent='已复制 ✓';setTimeout(()=>$('copy-sequence-id').textContent='复制指纹 ID',1200);}
  catch (_) {$('copy-sequence-id').textContent=id;}
};
$('kind').onchange=()=>{$('base').disabled=$('kind').value==='delete';};
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{
  $('sequence').value=Bio.demo; $('frame').value='0'; $('kind').value='replace'; $('base').disabled=false;
  const p={silent:[6,'C'],missense:[8,'C'],nonsense:[17,'A']}[b.dataset.preset];
  $('position').value=p[0];$('base').value=p[1];applyMutation();
});
$('play-original').onclick=()=>play('original'); $('play-variant').onclick=()=>play('variant'); $('stop').onclick=stop;
$('tempo').oninput=()=>{stop();$('tempo-value').textContent=$('tempo').value;};
$('download').onclick=()=>{
  if (!original) {$('error').textContent='请先完成有效的序列分析。';return;}
  const blob=new Blob([JSON.stringify({project:'Gene Beats',table:1,coordinate:'1-based on original input',mapping:{alphabet:Bio.alphabet,midi:Bio.pitches},original,orfs:Bio.findOrfs(original.sequence),fingerprint:Bio.dinucleotideProfile(original.sequence),variant,mutation:mutationRecord,challengeScore:challengePoints,evolution},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='gene-beats-experiment.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
analyze();

// Optional browser agent interface; normal browsers need no extension or polyfill.
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const tool = {
    name:'analyze_dna_sequence', title:'分析 DNA 序列',
    description:'替换实验室中的 DNA 输入并分析，清除之前的突变比较，不播放声音。',
    inputSchema:{type:'object',properties:{sequence:{type:'string'},frame:{type:'integer',enum:[0,1,2]}},required:['sequence'],additionalProperties:false},
    annotations:{readOnlyHint:false,untrustedContentHint:false},
    execute(input) {
      if (!input || typeof input.sequence!=='string' || ![0,1,2].includes(input.frame??0)) throw Error('需要 DNA 字符串和有效阅读框。');
      const clean=Bio.parse(input.sequence);
      $('sequence').value=clean; $('frame').value=String(input.frame??0); analyze();
      return {length:original.sequence.length,gc:original.gc,protein:original.protein,stopped:original.stopped};
    }
  };
  try { Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{}); } catch (_) {}
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
