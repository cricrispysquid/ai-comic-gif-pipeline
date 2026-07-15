const { createCanvas } = require('@napi-rs/canvas');
const GIFEncoder = require('gif-encoder-2');
const fs = require('fs');

const W=900,H=540,FPS=10,SECONDS=5;
const canvas=createCanvas(W,H),ctx=canvas.getContext('2d');
const queries=[{x:145,y:150,l:'d₁'},{x:145,y:270,l:'d₂'},{x:145,y:390,l:'d₃'}];
const memory=[
  {x:755,y:100,l:'“The”',valid:true},{x:755,y:190,l:'“cat”',valid:true},
  {x:755,y:280,l:'“sat”',valid:true},{x:755,y:385,l:'[PAD]',valid:false},
  {x:755,y:465,l:'[PAD]',valid:false}
];
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};

function node(n,a,b,alpha=1){
  ctx.save();ctx.globalAlpha=alpha;ctx.shadowColor=b;ctx.shadowBlur=20;
  const g=ctx.createRadialGradient(n.x-8,n.y-8,2,n.x,n.y,30);g.addColorStop(0,a);g.addColorStop(1,b);
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(n.x,n.y,28,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  ctx.fillStyle='#fff';ctx.font='600 14px "Segoe UI",Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(n.l,n.x,n.y+1);ctx.restore();
}
function edge(a,b,color,width,alpha,dash=[]){
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.globalAlpha=alpha;ctx.setLineDash(dash);
  ctx.beginPath();ctx.moveTo(a.x+28,a.y);ctx.bezierCurveTo(350,a.y,550,b.y,b.x-28,b.y);ctx.stroke();ctx.restore();
}
function title(main,sub){
  ctx.fillStyle='#f7f8ff';ctx.font='700 25px "Segoe UI",Arial';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(main,W/2,18);
  ctx.fillStyle='#aeb6d9';ctx.font='400 14px "Segoe UI",Arial';ctx.fillText(sub,W/2,52);
}
function render(frame){
  const t=frame/FPS;
  const bg=ctx.createRadialGradient(450,250,20,450,270,620);bg.addColorStop(0,'#171936');bg.addColorStop(1,'#070914');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(130,170,255,.08)';for(let x=20;x<W;x+=40)for(let y=20;y<H;y+=40){ctx.beginPath();ctx.arc(x,y,1,0,7);ctx.fill();}
  ctx.font='600 14px "Segoe UI",Arial';ctx.textAlign='center';ctx.fillStyle='#ff607d';ctx.fillText('Decoder queries',145,84);ctx.fillStyle='#20dbb2';ctx.fillText('Encoder memory',755,64);

  const connect=smooth((t-.7)/.5),problem=smooth((t-1.8)/.45)*(1-smooth((t-3.0)/.4)),mask=smooth((t-2.8)/.55);
  if(t<1.5) title('Cross-attention masking','Queries initially attend to every encoder position');
  else if(t<3) title('The padding problem','PAD tokens can receive attention probability');
  else title('Masked cross-attention','Padding logits receive −∞ before softmax');

  if(connect) for(const q of queries)for(const m of memory){
    if(!m.valid&&mask) edge(q,m,'#626a8e',1.2,connect*(1-mask)*.5,[5,7]);
    else edge(q,m,!m.valid?'#ff496b':'#789fff',!m.valid?3:1.5,connect*(!m.valid?problem:.24));
  }
  queries.forEach(q=>node(q,'#ff6d86','#c92f54'));
  memory.forEach(m=>node(m,m.valid?'#3be2b9':'#737b99',m.valid?'#078e7f':'#353a51',m.valid?1:1-mask*.55));

  if(mask){
    memory.filter(m=>!m.valid).forEach(m=>{ctx.save();ctx.globalAlpha=mask;ctx.strokeStyle='#ff496b';ctx.lineWidth=4;ctx.shadowColor='#ff496b';ctx.shadowBlur=10;ctx.beginPath();ctx.moveTo(m.x-12,m.y-12);ctx.lineTo(m.x+12,m.y+12);ctx.moveTo(m.x+12,m.y-12);ctx.lineTo(m.x-12,m.y+12);ctx.stroke();ctx.restore();});
    ctx.save();ctx.globalAlpha=mask;ctx.fillStyle='#11142c';ctx.strokeStyle='#56ffd5';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(290,465,320,48,15);ctx.fill();ctx.stroke();ctx.fillStyle='#b9fff0';ctx.font='600 15px "Consolas",monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('Mᵢⱼ = 0 (valid),  −∞ (PAD)',450,490);ctx.restore();
  } else if(problem){
    ctx.save();ctx.globalAlpha=problem;ctx.fillStyle='#ff607d';ctx.font='600 16px "Segoe UI",Arial';ctx.textAlign='center';ctx.fillText('⚠ Padding pollutes the attention distribution',450,505);ctx.restore();
  }
}

const gif=new GIFEncoder(W,H);gif.start();gif.setRepeat(0);gif.setDelay(1000/FPS);gif.setQuality(15);
for(let f=0;f<FPS*SECONDS;f++){render(f);gif.addFrame(ctx);}
gif.finish();fs.writeFileSync('research_assets/cross_attention_prototype.gif',gif.out.getData());
console.log('Wrote research_assets/cross_attention_prototype.gif');
