const socket=io(),$=id=>document.getElementById(id);
let current=null, myId=null, latest=null;
const COLORS={red:"#e65b63",green:"#35ad7c",yellow:"#edc449",blue:"#5489e8"};
const START={red:0,green:13,yellow:26,blue:39};
const safe=new Set([0,8,13,21,26,34,39,47]);
const NS="http://www.w3.org/2000/svg";
function el(tag,attrs={},parent){const n=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(parent)parent.appendChild(n);return n;}
function showError(s=""){$("error").textContent=s}
function nickname(){return $("name").value.trim()||"Player"}
function enter(res){if(!res?.ok){showError(res?.error||"Could not join room.");return}current=res.room.code;myId=socket.id;$("setup").classList.add("hidden");$("game").classList.remove("hidden");render(res.room);showError("")}
$("quick").onclick=()=>socket.emit("match:quick",{name:nickname(),maxPlayers:$("mode").value},enter);
$("create").onclick=()=>socket.emit("room:create",{name:nickname(),maxPlayers:$("mode").value},enter);
$("join").onclick=()=>socket.emit("room:join",{name:nickname(),code:$("roomCode").value},enter);
$("copy").onclick=async()=>{try{await navigator.clipboard.writeText(current);$("copy").textContent="Copied!"}catch{$("copy").textContent=current}};
$("leave").onclick=()=>location.reload();
$("roll").onclick=()=>socket.emit("game:roll",{},r=>{if(!r?.ok)showError(r?.error)});
socket.on("connect",()=>{myId=socket.id});
socket.on("connect_error",()=>showError("Connection lost. Refresh and try again."));
socket.on("room:update",r=>{if(r.code===current)render(r)});
socket.on("game:error",e=>showError(e.message));
function render(r){
 latest=r;$("code").textContent=r.code;$("players").innerHTML="";
 r.players.forEach((p,i)=>{const d=document.createElement("span");d.className="player"+(i===r.currentTurn&&r.status==="playing"?" active":"");d.innerHTML=`<span class="dot" style="background:${COLORS[p.color]}"></span>${escapeHtml(p.name)}${p.id===myId?" (you)":""}`;$("players").appendChild(d)});
 $("status").textContent=r.message|| (r.status==="waiting"?`Waiting for players (${r.players.length}/${r.maxPlayers})`:"");
 $("roll").disabled=!(r.status==="playing"&&r.players[r.currentTurn]?.id===myId&&r.dice===null);
 $("dice").textContent=r.dice?["⚀","⚁","⚂","⚃","⚄","⚅"][r.dice-1]:"—";
 drawBoard(r);
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function point(i){const a=-Math.PI/2+i*2*Math.PI/52;return{x:300+210*Math.cos(a),y:300+210*Math.sin(a)}}
function homePoint(color,step){
 const angle={red:-Math.PI/2,green:0,yellow:Math.PI/2,blue:Math.PI}[color];
 const a=angle, radius=150-step*23;
 return{x:300+radius*Math.cos(a),y:300+radius*Math.sin(a)};
}
function yardPoint(color,i){
 const centers={red:[115,115],green:[485,115],yellow:[485,485],blue:[115,485]};
 const [cx,cy]=centers[color],offs=[[-25,-25],[25,-25],[-25,25],[25,25]][i];
 return{x:cx+offs[0],y:cy+offs[1]};
}
function drawBoard(r){
 const svg=$("board");svg.innerHTML="";
 el("rect",{x:5,y:5,width:590,height:590,rx:28,fill:"#fff",stroke:"#dfe3ee","stroke-width":10},svg);
 const bases={red:[25,25],green:[425,25],yellow:[425,425],blue:[25,425]};
 Object.entries(bases).forEach(([c,[x,y]])=>{
   el("rect",{x,y,width:150,height:150,rx:20,fill:COLORS[c],opacity:.18,stroke:COLORS[c],"stroke-width":5},svg);
   el("text",{x:x+75,y:y+25,"text-anchor":"middle",fill:COLORS[c],"font-size":15,"font-weight":800},svg).textContent=c.toUpperCase();
   for(let i=0;i<4;i++){const p=yardPoint(c,i);el("circle",{cx:p.x,cy:p.y,r:17,fill:"#fff",stroke:COLORS[c],"stroke-width":5},svg)}
 });
 for(let i=0;i<52;i++){const p=point(i),color=Object.keys(START).find(c=>START[c]===i);el("circle",{cx:p.x,cy:p.y,r:12,fill:color?COLORS[color]:(safe.has(i)?"#f3d77b":"#f0f2f7"),stroke:"#cbd0dd","stroke-width":2},svg)}
 Object.keys(START).forEach(c=>{for(let s=0;s<6;s++){const p=homePoint(c,s);el("circle",{cx:p.x,cy:p.y,r:12,fill:COLORS[c],opacity:.8,stroke:"#fff","stroke-width":2},svg)}});
 el("circle",{cx:300,cy:300,r:43,fill:"#f1f2ff",stroke:"#d9dcf5","stroke-width":3},svg);
 el("text",{x:300,y:296,"text-anchor":"middle",fill:"#5358d7","font-size":13,"font-weight":900},svg).textContent="LUDO";
 el("text",{x:300,y:313,"text-anchor":"middle",fill:"#73799a","font-size":9,"font-weight":800},svg).textContent="ARENA";
 const active=r.players[r.currentTurn],isMine=active?.id===myId;
 r.players.forEach(p=>p.tokens.forEach((pos,i)=>{
   let q=pos===-1?yardPoint(p.color,i):pos===57?{x:300,y:300}:pos<=50?point((START[p.color]+pos)%52):homePoint(p.color,pos-51);
   const movable=isMine&&r.dice!==null&&r.legalMoves.includes(i);
   const g=el("g",{class:movable?"movable":""},svg);
   if(movable)el("circle",{cx:q.x,cy:q.y,r:24,fill:"none",stroke:"#5b5de2","stroke-width":4,"stroke-dasharray":"4 4"},g);
   el("circle",{cx:q.x,cy:q.y,r:movable?16:13,fill:COLORS[p.color],stroke:"#fff","stroke-width":3},g);
   el("text",{x:q.x,y:q.y+4,"text-anchor":"middle",fill:"#fff","font-size":11,"font-weight":900},g).textContent=String(i+1);
   if(movable){g.style.cursor="pointer";g.addEventListener("click",()=>socket.emit("game:move",{tokenIndex:i},res=>{if(!res?.ok)showError(res?.error)}))}
 }));
}
