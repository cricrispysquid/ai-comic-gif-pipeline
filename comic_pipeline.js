const { createCanvas } = require('@napi-rs/canvas');
const GIFEncoder = require('gif-encoder-2');
const fs = require('fs');
const path = require('path');

const W = 1000, H = 1000, FPS = 12, DURATION = 2;
const PALETTE = ['#dff4ee', '#e5eafe', '#f7e5f1', '#fff0cf', '#e5f5dc'];
const ACCENTS = ['#259d8f', '#557bd8', '#ad67a7', '#e99b1c', '#69a34f'];

function usage() {
  console.log('Usage: node comic_pipeline.js <article.md|storyboard.json> [output-dir]');
}

function slug(s) {
  return String(s || 'article').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'article';
}

function sentences(text) {
  return text.replace(/\s+/g, ' ').trim().split(/(?<=[。！？.!?])\s*/).filter(Boolean);
}

function shortTitle(text, index) {
  const clean = text.replace(/^[\d.)、\s-]+/, '').trim();
  const first = sentences(clean)[0] || clean;
  return first.length > 34 ? first.slice(0, 32) + '…' : first || `要点 ${index + 1}`;
}

function parseMarkdown(raw) {
  const lines = raw.replace(/\r/g, '').split('\n');
  let title = 'Untitled Article';
  const sections = [];
  let current = { heading: 'Overview', paragraphs: [] };
  let paragraph = [];

  function flushParagraph() {
    const value = paragraph.join(' ').trim();
    if (value) current.paragraphs.push(value);
    paragraph = [];
  }
  function flushSection() {
    flushParagraph();
    if (current.paragraphs.length) sections.push(current);
  }

  for (const line of lines) {
    const h = line.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      if (h[1].length === 1 && title === 'Untitled Article') { title = h[2].trim(); continue; }
      flushSection();
      current = { heading: h[2].trim(), paragraphs: [] };
    } else if (!line.trim()) flushParagraph();
    else paragraph.push(line.replace(/^[-*]\s+/, '').trim());
  }
  flushSection();
  if (!sections.length) sections.push({ heading: 'Overview', paragraphs: [raw.trim()] });
  return { title, sections };
}

// Long articles are paginated by semantic section first, then by card capacity.
// An LLM may replace this heuristic by writing the same storyboard JSON contract.
function articleToStoryboard(article) {
  const pages = [];
  for (const section of article.sections) {
    const units = [];
    for (const paragraph of section.paragraphs) {
      const ss = sentences(paragraph);
      if (paragraph.length <= 210 || ss.length <= 1) units.push(paragraph);
      else {
        let buf = '';
        for (const s of ss) {
          if ((buf + s).length > 190 && buf) { units.push(buf); buf = ''; }
          buf += s;
        }
        if (buf) units.push(buf);
      }
    }
    for (let i = 0; i < units.length; i += 3) {
      const group = units.slice(i, i + 3);
      pages.push({
        title: article.title,
        section: section.heading,
        pageLabel: `${Math.floor(i / 3) + 1}`,
        cards: group.map((body, j) => ({
          title: shortTitle(body, j),
          body,
          icon: ['chat', 'brain', 'schema', 'graph'][(i + j) % 4]
        }))
      });
    }
  }
  return { version: 1, style: 'pastel-handdrawn', title: article.title, pages };
}

function validateStoryboard(sb) {
  if (!sb || !Array.isArray(sb.pages) || !sb.pages.length) throw new Error('storyboard.pages must be a non-empty array');
  sb.pages.forEach((p, i) => {
    if (!p.title || !p.section) throw new Error(`page ${i + 1}: title and section are required`);
    if (!Array.isArray(p.cards) || p.cards.length < 1 || p.cards.length > 3) throw new Error(`page ${i + 1}: cards must contain 1–3 items`);
  });
}

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function wrap(ctx, text, width, maxLines) {
  const value = String(text);
  const latin = /\s/.test(value) && !/[\u3400-\u9fff]/.test(value);
  const tokens = latin ? value.trim().split(/\s+/).map((v,i)=>i ? ' '+v : v) : Array.from(value);
  const lines = []; let line = ''; let consumed = 0;
  for (const token of tokens) {
    if (ctx.measureText(line + token).width > width && line) {
      lines.push(line.trim()); line = token.trimStart();
    } else line += token;
    consumed++;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line.trim());
  if (consumed < tokens.length && lines.length) lines[lines.length - 1] = lines[lines.length - 1].replace(/[\s.,;:!?。！？、]*$/, '') + '…';
  return lines;
}

function icon(ctx, name, x, y, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (name === 'chat') {
    roundRect(ctx, x-30,y-24,60,43,16); ctx.stroke(); ctx.beginPath();ctx.moveTo(x-8,y+19);ctx.lineTo(x-18,y+32);ctx.lineTo(x+5,y+19);ctx.stroke();
    ctx.beginPath();[-14,0,14].forEach(dx=>{ctx.moveTo(x+dx,y-2);ctx.arc(x+dx,y-2,2,0,7)});ctx.fill();
  } else if (name === 'brain') {
    for (const [dx,dy] of [[-15,-12],[0,-17],[16,-10],[-19,5],[-6,11],[10,10],[21,4]]) {ctx.beginPath();ctx.arc(x+dx,y+dy,15,0,7);ctx.stroke();}
  } else if (name === 'schema') {
    [-22,0,22].forEach((dy,i)=>{roundRect(ctx,x-29,y+dy-8,58,16,7);ctx.stroke();ctx.beginPath();ctx.arc(x-17,y+dy,3,0,7);ctx.fill();});
  } else {
    const pts=[[-22,10],[-8,-18],[13,-13],[25,13],[2,24]];pts.forEach(([dx,dy])=>{ctx.beginPath();ctx.arc(x+dx,y+dy,7,0,7);ctx.fill();});
    ctx.beginPath();pts.forEach(([dx,dy],i)=>i?ctx.lineTo(x+dx,y+dy):ctx.moveTo(x+dx,y+dy));ctx.closePath();ctx.stroke();
  }
  ctx.restore();
}

function drawCharacter(ctx, x, y, phase) {
  const bob = Math.sin(phase * Math.PI * 2) * 5;
  ctx.save();ctx.translate(x,y+bob);ctx.strokeStyle='#342d55';ctx.lineWidth=5;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.fillStyle='#8057d9';ctx.beginPath();ctx.arc(0,-40,32,Math.PI,0);ctx.lineTo(30,-25);ctx.lineTo(-30,-25);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#ffd8bd';ctx.beginPath();ctx.arc(0,-20,29,0,7);ctx.fill();ctx.stroke();
  ctx.fillStyle='#32c7c2';roundRect(ctx,-35,12,70,58,25);ctx.fill();ctx.stroke();
  ctx.fillStyle='#fff';roundRect(ctx,-47,48,94,55,9);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.arc(-11,-21,7,0,7);ctx.arc(11,-21,7,0,7);ctx.stroke();ctx.beginPath();ctx.moveTo(-4,-4);ctx.quadraticCurveTo(0,1,7,-4);ctx.stroke();
  ctx.restore();
}

function drawPage(ctx, page, pageIndex, total, frame) {
  const t = frame / (FPS * DURATION); ctx.fillStyle='#fffdf9';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(68,86,130,.06)';ctx.lineWidth=1;for(let y=18;y<H;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  ctx.fillStyle='#b98bff';roundRect(ctx,24,28,12,82,6);ctx.fill();
  ctx.fillStyle='#2f3151';ctx.font='700 43px "Comic Sans MS","Segoe UI",sans-serif';ctx.textAlign='left';ctx.textBaseline='top';
  const titleLines=wrap(ctx,page.title,750,2);titleLines.forEach((l,i)=>ctx.fillText(l,55,24+i*48));
  ctx.font='700 25px "Comic Sans MS","Segoe UI",sans-serif';ctx.fillStyle='#277f76';ctx.fillText(page.section,58,124);
  ctx.font='600 17px "Comic Sans MS","Segoe UI",sans-serif';ctx.fillStyle='#737690';ctx.textAlign='right';ctx.fillText(`${pageIndex+1} / ${total}`,950,44);

  drawCharacter(ctx,125,245,t);
  ctx.strokeStyle='#3b3b4d';ctx.lineWidth=3;ctx.setLineDash([10,9]);ctx.lineDashOffset=-frame*3;ctx.beginPath();ctx.moveTo(205,235);ctx.lineTo(300,235);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#3b3b4d';ctx.beginPath();ctx.moveTo(300,235);ctx.lineTo(285,226);ctx.lineTo(285,244);ctx.closePath();ctx.fill();
  roundRect(ctx,314,175,620,120,24);ctx.fillStyle='#eef0fb';ctx.fill();ctx.strokeStyle='#758bd8';ctx.lineWidth=3;ctx.stroke();
  ctx.fillStyle='#4053a0';ctx.font='700 28px "Comic Sans MS","Segoe UI",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('AI turns ideas into a visual story',624,235);

  const count=page.cards.length, gap=20, cardW=(880-gap*(count-1))/count, y=390, h=470;
  page.cards.forEach((card,i)=>{
    const x=60+i*(cardW+gap), pulse=1+0.018*Math.sin(t*Math.PI*2+i*.8);ctx.save();ctx.translate(x+cardW/2,y+h/2);ctx.scale(pulse,pulse);ctx.translate(-(x+cardW/2),-(y+h/2));
    roundRect(ctx,x,y,cardW,h,28);ctx.fillStyle=PALETTE[i%PALETTE.length];ctx.fill();ctx.strokeStyle=ACCENTS[i%ACCENTS.length];ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x+cardW/2,y+75,46,0,7);ctx.fill();ctx.stroke();icon(ctx,card.icon,x+cardW/2,y+75,ACCENTS[i%ACCENTS.length]);
    ctx.fillStyle='#2d2e43';ctx.font='700 21px "Comic Sans MS","Segoe UI",sans-serif';ctx.textAlign='center';ctx.textBaseline='top';
    wrap(ctx,card.title,cardW-28,3).forEach((l,j)=>ctx.fillText(l,x+cardW/2,y+138+j*28));
    ctx.fillStyle='#4f5366';ctx.font='400 17px "Comic Sans MS","Segoe UI",sans-serif';
    wrap(ctx,card.body,cardW-32,9).forEach((l,j)=>ctx.fillText(l,x+cardW/2,y+245+j*25));
    ctx.fillStyle=ACCENTS[i%ACCENTS.length];ctx.beginPath();ctx.arc(x+24,y+24,16,0,7);ctx.fill();ctx.fillStyle='#fff';ctx.font='700 15px Arial';ctx.textBaseline='middle';ctx.fillText(String(i+1),x+24,y+25);ctx.restore();
  });
  ctx.fillStyle='#7a7d8f';ctx.font='500 15px "Comic Sans MS","Segoe UI",sans-serif';ctx.textAlign='center';ctx.fillText('Generated from a structured storyboard • seamless 2-second loop',W/2,940);
}

function renderGif(page, index, total, outPath) {
  const canvas=createCanvas(W,H),ctx=canvas.getContext('2d'),gif=new GIFEncoder(W,H);gif.start();gif.setRepeat(0);gif.setDelay(1000/FPS);gif.setQuality(15);
  for(let f=0;f<FPS*DURATION;f++){drawPage(ctx,page,index,total,f);gif.addFrame(ctx);}
  gif.finish();fs.writeFileSync(outPath,gif.out.getData());
}

function main() {
  const input=process.argv[2], outDir=path.resolve(process.argv[3]||'output');if(!input){usage();process.exit(1);} const abs=path.resolve(input);const raw=fs.readFileSync(abs,'utf8');
  const storyboard=path.extname(abs).toLowerCase()==='.json'?JSON.parse(raw):articleToStoryboard(parseMarkdown(raw));validateStoryboard(storyboard);
  fs.mkdirSync(outDir,{recursive:true});fs.writeFileSync(path.join(outDir,'storyboard.json'),JSON.stringify(storyboard,null,2));
  const outputs=[];storyboard.pages.forEach((page,i)=>{const name=`${String(i+1).padStart(2,'0')}-${slug(page.section)}.gif`;renderGif(page,i,storyboard.pages.length,path.join(outDir,name));outputs.push(name);console.log(`Rendered ${name}`);});
  fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify({source:path.basename(abs),title:storyboard.title,pages:outputs},null,2));console.log(`Done: ${outputs.length} GIF(s) in ${outDir}`);
}

main();
