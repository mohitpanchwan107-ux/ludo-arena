const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const rooms = new Map();
const COLORS = ["red", "green", "yellow", "blue"];
const START = { red: 0, green: 13, yellow: 26, blue: 39 };
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

app.use(express.static("public"));

function makeCode() { return crypto.randomBytes(3).toString("hex").toUpperCase(); }
function newPlayer(id, name, color) {
  return { id, name: String(name || "Player").trim().slice(0,18) || "Player", color, tokens: [-1,-1,-1,-1] };
}
function roomView(r) {
  return {
    code:r.code, maxPlayers:r.maxPlayers, status:r.status,
    players:r.players.map(p=>({id:p.id,name:p.name,color:p.color,tokens:p.tokens})),
    currentTurn:r.currentTurn, dice:r.dice, legalMoves:r.legalMoves,
    winner:r.winner, message:r.message
  };
}
function emitRoom(r) { io.to(r.code).emit("room:update", roomView(r)); }
function findRoom(socket) { return rooms.get(socket.data.roomCode); }
function activePlayer(r) { return r.players[r.currentTurn]; }
function legalFor(p, dice) {
  return p.tokens.map((pos,i)=>({i,pos,ok: pos===57 ? false : (pos===-1 ? dice===6 : pos+dice<=57)}))
    .filter(x=>x.ok).map(x=>x.i);
}
function advanceTurn(r) {
  r.currentTurn = (r.currentTurn + 1) % r.players.length;
  r.dice = null; r.legalMoves = [];
}
function leaveRoom(socket) {
  const code=socket.data.roomCode;
  if(!code) return;
  const r=rooms.get(code);
  if(r) {
    r.players=r.players.filter(p=>p.id!==socket.id);
    if(!r.players.length) rooms.delete(code);
    else {
      if(r.currentTurn>=r.players.length) r.currentTurn=0;
      if(r.players.length<r.maxPlayers) r.status="waiting";
      r.dice=null; r.legalMoves=[]; r.message="A player left the room.";
      emitRoom(r);
    }
  }
  socket.leave(code); socket.data.roomCode=null;
}
function join(socket,r,name) {
  const color= r.maxPlayers===2 ? (r.players.length===0?"red":"yellow") : COLORS[r.players.length];
  r.players.push(newPlayer(socket.id,name,color));
  socket.join(r.code); socket.data.roomCode=r.code;
  if(r.players.length===r.maxPlayers) {
    r.status="playing"; r.currentTurn=0; r.message="Game started! Roll a six to bring a token out.";
  }
  emitRoom(r);
}

io.on("connection",socket=>{
  socket.on("room:create",({name,maxPlayers},cb=()=>{})=>{
    leaveRoom(socket);
    const n=Number(maxPlayers)===2?2:4;
    let code=makeCode(); while(rooms.has(code)) code=makeCode();
    const r={code,maxPlayers:n,players:[],status:"waiting",currentTurn:0,dice:null,legalMoves:[],winner:null,message:"Waiting for players to join."};
    rooms.set(code,r); join(socket,r,name); cb({ok:true,room:roomView(r)});
  });
  socket.on("room:join",({name,code},cb=()=>{})=>{
    leaveRoom(socket);
    const r=rooms.get(String(code||"").trim().toUpperCase());
    if(!r) return cb({ok:false,error:"Room not found."});
    if(r.status!=="waiting"||r.players.length>=r.maxPlayers) return cb({ok:false,error:"Room is full or already started."});
    join(socket,r,name); cb({ok:true,room:roomView(r)});
  });
  socket.on("match:quick",({name,maxPlayers},cb=()=>{})=>{
    leaveRoom(socket);
    const n=Number(maxPlayers)===2?2:4;
    let r=[...rooms.values()].find(x=>x.maxPlayers===n&&x.status==="waiting"&&x.players.length<n);
    if(!r) {
      let code=makeCode(); while(rooms.has(code)) code=makeCode();
      r={code,maxPlayers:n,players:[],status:"waiting",currentTurn:0,dice:null,legalMoves:[],winner:null,message:"Finding players…"};
      rooms.set(code,r);
    }
    join(socket,r,name); cb({ok:true,room:roomView(r)});
  });
  socket.on("game:roll",(_,cb=()=>{})=>{
    const r=findRoom(socket);
    if(!r||r.status!=="playing") return cb({ok:false,error:"The game is not ready."});
    if(activePlayer(r)?.id!==socket.id) return cb({ok:false,error:"It is not your turn."});
    if(r.dice!==null) return cb({ok:false,error:"Move one of your highlighted tokens first."});
    const roll=1+Math.floor(Math.random()*6);
    r.dice=roll;
    r.legalMoves=legalFor(activePlayer(r),roll);
    if(!r.legalMoves.length) {
      r.message=`${activePlayer(r).name} rolled ${roll}. No legal move.`;
      if(roll!==6) advanceTurn(); else r.dice=null;
    } else r.message=`${activePlayer(r).name} rolled ${roll}. Choose a highlighted token.`;
    emitRoom(r); cb({ok:true});
  });
  socket.on("game:move",({tokenIndex},cb=()=>{})=>{
    const r=findRoom(socket);
    if(!r||r.status!=="playing") return cb({ok:false,error:"The game is not ready."});
    const p=activePlayer(r);
    if(p?.id!==socket.id) return cb({ok:false,error:"It is not your turn."});
    const idx=Number(tokenIndex);
    if(!Number.isInteger(idx)||!r.legalMoves.includes(idx)||r.dice===null) return cb({ok:false,error:"That token cannot move."});
    const roll=r.dice;
    const old=p.tokens[idx];
    const next=old===-1?0:old+roll;
    p.tokens[idx]=next;
    let captured=false;
    if(next<=50) {
      const global=(START[p.color]+next)%52;
      if(!SAFE.has(global)) {
        for(const opponent of r.players) {
          if(opponent.id===p.id) continue;
          opponent.tokens=opponent.tokens.map(pos=>{
            if(pos>=0&&pos<=50&&(START[opponent.color]+pos)%52===global){captured=true;return -1;}
            return pos;
          });
        }
      }
    }
    if(p.tokens.every(x=>x===57)) {
      r.status="finished"; r.winner=p.id; r.message=`${p.name} wins the game!`;
      r.dice=null; r.legalMoves=[]; emitRoom(r); return cb({ok:true});
    }
    r.message=captured?`${p.name} captured a token!`:next===57?`${p.name} brought a token home!`:`${p.name} moved a token.`;
    if(roll!==6&&!captured) advanceTurn();
    else { r.dice=null; r.legalMoves=[]; }
    emitRoom(r); cb({ok:true});
  });
  socket.on("disconnect",()=>leaveRoom(socket));
});

server.listen(PORT,()=>console.log(`Ludo Arena v2 running on http://localhost:${PORT}`));