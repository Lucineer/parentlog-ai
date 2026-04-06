export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

    if (request.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Allow-Headers': '*' } });

    if (url.pathname === '/health') return new Response(JSON.stringify({ status: 'ok', repo: 'parentlog-ai', timestamp: Date.now() }), { headers });
    if (url.pathname === '/vessel.json') { try { const vj = await import('./vessel.json', { with: { type: 'json' } }); return new Response(JSON.stringify(vj.default || vj), { headers }); } catch { return new Response('{}', { headers }); } }

    // Landing page
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(getLandingHTML(), { headers: { 'Content-Type': 'text/html' } });
    }

    // App
    if (url.pathname === '/app' && request.method === 'GET') {
      return new Response(getAppHTML(), { headers: { 'Content-Type': 'text/html' } });
    }

    // Chat SSE
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      const { message } = await request.json();
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const resp = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}` },
            body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: 'You are a caring parenting companion AI called ParentLog. Help parents track milestones, manage schedules, and get age-appropriate advice. Be warm, supportive, and practical.' }, { role: 'user', content: message }], stream: true })
          });
          const reader = resp.body!.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) { controller.enqueue(encoder.encode('data: [DONE]\n\n')); break; }
            const chunk = new TextDecoder().decode(value);
            for (const line of chunk.split('\n')) {
              if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                try { const d = JSON.parse(line.slice(6)); if (d.choices?.[0]?.delta?.content) controller.enqueue(encoder.encode(`data: ${JSON.stringify(d.choices[0].delta.content)}\n\n`)); } catch {}
              }
            }
          }
          controller.close();
        }
      });
      return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
    }

    // Children CRUD
    if (url.pathname === '/api/children') {
      const children = await env.PARENTLOG_KV.get('children', 'json') || [];
      if (request.method === 'GET') return new Response(JSON.stringify(children), { headers });
      if (request.method === 'POST') {
        const child = await request.json();
        child.id = crypto.randomUUID();
        child.createdAt = Date.now();
        children.push(child);
        await env.PARENTLOG_KV.put('children', JSON.stringify(children));
        return new Response(JSON.stringify(child), { headers });
      }
    }

    // Milestones
    if (url.pathname === '/api/milestones') {
      const milestones = await env.PARENTLOG_KV.get('milestones', 'json') || [];
      if (request.method === 'GET') return new Response(JSON.stringify(milestones), { headers });
      if (request.method === 'POST') {
        const m = await request.json();
        m.id = crypto.randomUUID();
        m.date = Date.now();
        milestones.push(m);
        await env.PARENTLOG_KV.put('milestones', JSON.stringify(milestones));
        return new Response(JSON.stringify(m), { headers });
      }
    }

    // Memories
    if (url.pathname === '/api/memories') {
      const memories = await env.PARENTLOG_KV.get('memories', 'json') || [];
      if (request.method === 'GET') return new Response(JSON.stringify(memories), { headers });
      if (request.method === 'POST') {
        const mem = await request.json();
        mem.id = crypto.randomUUID();
        mem.date = Date.now();
        memories.push(mem);
        await env.PARENTLOG_KV.put('memories', JSON.stringify(memories));
        return new Response(JSON.stringify(mem), { headers });
      }
    }

    return new Response('Not found', { status: 404, headers });
  }
};

function getLandingHTML(): string { return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Parentlog — AI-powered parenting companion</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Inter,system-ui,sans-serif;background:#0a0a0f;color:#e2e8f0;min-height:100vh}a{color:#f472b6;text-decoration:none}.hero{max-width:800px;margin:0 auto;padding:80px 24px 40px;text-align:center}.logo{font-size:64px;margin-bottom:16px}h1{font-size:clamp(2rem,5vw,3rem);font-weight:700;background:linear-gradient(135deg,#f472b6,#f472b688);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:12px}.tagline{font-size:1.15rem;color:#94a3b8;max-width:500px;margin:0 auto 48px;line-height:1.6}.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;max-width:700px;margin:0 auto;padding:0 24px 60px}.feat{background:#111118;border:1px solid #1e1e2e;border-radius:12px;padding:20px;transition:border-color .2s}.feat:hover{border-color:#f472b644}.feat-icon{color:#f472b6;font-size:1.2rem;margin-bottom:8px}.feat-text{font-size:.9rem;color:#cbd5e1}.chat-section{max-width:700px;margin:0 auto;padding:0 24px 80px}.chat-box{background:#111118;border:1px solid #1e1e2e;border-radius:16px;padding:24px}.chat-box h3{font-size:1.1rem;margin-bottom:12px;color:#f472b6}.chat-box p{font-size:.9rem;color:#94a3b8;line-height:1.6;margin-bottom:16px}.chat-input{display:flex;gap:8px}.chat-input input{flex:1;background:#0a0a0f;border:1px solid #1e1e2e;border-radius:8px;padding:10px 14px;color:#e2e8f0;font-size:.9rem;outline:none}.chat-input input:focus{border-color:#f472b6}.chat-input button{background:#f472b6;color:#0a0a0f;border:none;border-radius:8px;padding:10px 18px;font-weight:600;cursor:pointer;font-size:.9rem}.chat-input button:hover{opacity:.9}.fleet{text-align:center;padding:40px 24px;color:#475569;font-size:.8rem}.fleet a{color:#64748b;margin:0 8px}</style></head><body><div class="hero"><div class="logo">👨‍👩‍👧‍👦</div><h1>Parentlog</h1><p class="tagline">Track milestones, optimize routines, and get AI-powered parenting guidance.</p></div><div class="features"><div class="feat"><div class="feat-icon">✦</div><div class="feat-text">Milestone tracking</div></div><div class="feat"><div class="feat-icon">✦</div><div class="feat-text">Sleep schedule optimizer</div></div><div class="feat"><div class="feat-icon">✦</div><div class="feat-text">Activity suggestions</div></div><div class="feat"><div class="feat-icon">✦</div><div class="feat-text">Health & wellness logs</div></div><div class="feat"><div class="feat-icon">✦</div><div class="feat-text">Parenting tips AI chat</div></div><div class="feat"><div class="feat-icon">✦</div><div class="feat-text">Growth journal</div></div></div><div class="chat-section"><div class="chat-box"><h3>👨‍👩‍👧‍👦 Chat with Parentlog</h3><p>Powered by <a href="https://cocapn.ai">Cocapn</a> — bring your own API key or try with 5 free messages.</p><div class="chat-input"><input type="text" id="msg" placeholder="Ask anything..."><button onclick="send()">Send</button></div></div></div><div class="fleet"><a href="https://the-fleet.casey-digennaro.workers.dev">⚓ The Fleet</a> · <a href="https://cocapn.ai">Cocapn</a> · <a href="https://github.com/Lucineer/parentlog-ai">GitHub</a></div><script>async function send(){const m=document.getElementById("msg"),t=m.value.trim();if(!t)return;const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:t})});const d=await r.json();alert(d.response||d.error||"No response");m.value=""}document.getElementById("msg").addEventListener("keydown",e=>{if(e.key==="Enter")send()});</script></body></html>`; }

function getAppHTML(): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ParentLog</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui;background:#FFFBF0;color:#333;display:flex;height:100vh}
.sidebar{width:280px;background:white;border-right:1px solid #E5E7EB;padding:1rem;overflow-y:auto;flex-shrink:0}
.sidebar h2{color:#D97706;font-size:1rem;margin-bottom:1rem}
.sidebar a{display:block;padding:0.5rem;color:#666;text-decoration:none;border-radius:8px;margin-bottom:0.25rem;cursor:pointer}
.sidebar a:hover,.sidebar a.active{background:#FEF3C7;color:#92400E}
.main{flex:1;display:flex;flex-direction:column}
.header{padding:1rem 1.5rem;background:white;border-bottom:1px solid #E5E7EB;font-weight:600;color:#D97706}
.content{flex:1;overflow-y:auto;padding:1.5rem}
.form-group{margin-bottom:1rem}
.form-group label{display:block;font-weight:600;margin-bottom:0.25rem;font-size:0.875rem;color:#666}
.form-group input,.form-group textarea,.form-group select{width:100%;padding:0.5rem;border:1px solid #D1D5DB;border-radius:8px;font-size:0.9rem}
.btn{padding:0.5rem 1rem;background:#F59E0B;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600}
.btn:hover{background:#D97706}
.card{background:white;padding:1rem;border-radius:12px;margin-bottom:0.75rem;box-shadow:0 1px 3px rgba(0,0,0,0.08)}
.chat-area{flex:1;display:flex;flex-direction:column}
.messages{flex:1;overflow-y:auto;padding:1rem}
.msg{margin-bottom:1rem;padding:0.75rem 1rem;border-radius:12px;max-width:80%}
.msg.user{background:#FEF3C7;margin-left:auto}
.msg.ai{background:white;border:1px solid #E5E7EB}
.input-area{display:flex;padding:1rem;gap:0.5rem;background:white;border-top:1px solid #E5E7EB}
.input-area input{flex:1;padding:0.75rem;border:1px solid #D1D5DB;border-radius:8px}
.input-area button{padding:0.75rem 1.5rem;background:#F59E0B;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600}
.page{display:none}.page.active{display:block}
</style></head><body>
<div class="sidebar"><h2>👶 ParentLog</h2>
<a class="active" onclick="showPage('dashboard')">Dashboard</a>
<a onclick="showPage('children')">Children</a>
<a onclick="showPage('milestones')">Milestones</a>
<a onclick="showPage('memories')">Memories</a>
<a onclick="showPage('chat')">Ask AI</a>
</div>
<div class="main">
<div class="header" id="page-title">Dashboard</div>
<div class="content">
<div id="dashboard" class="page active"><p style="color:#666">Welcome to ParentLog. Track your children, milestones, and precious memories. The cocapn remembers everything.</p></div>
<div id="children" class="page">
<div id="children-list"></div>
<h3 style="margin:1rem 0 0.5rem">Add Child</h3>
<div class="form-group"><input id="child-name" placeholder="Name"></div>
<div class="form-group"><input id="child-dob" type="date" placeholder="Date of birth"></div>
<button class="btn" onclick="addChild()">Add</button>
</div>
<div id="milestones" class="page">
<div id="milestones-list"></div>
<h3 style="margin:1rem 0 0.5rem">Log Milestone</h3>
<div class="form-group"><input id="milestone-title" placeholder="First steps, First word..."></div>
<div class="form-group"><textarea id="milestone-note" rows="2" placeholder="Notes"></textarea></div>
<button class="btn" onclick="addMilestone()">Log</button>
</div>
<div id="memories" class="page">
<div id="memories-list"></div>
<h3 style="margin:1rem 0 0.5rem">Save a Memory</h3>
<div class="form-group"><input id="memory-title" placeholder="What happened?"></div>
<div class="form-group"><textarea id="memory-content" rows="3" placeholder="Tell the story..."></textarea></div>
<button class="btn" onclick="addMemory()">Save</button>
</div>
<div id="chat" class="page chat-area"><div class="messages" id="chat-messages"></div><div class="input-area"><input id="chat-input" placeholder="Ask about parenting..." onkeypress="if(event.key==='Enter')sendChat()"><button onclick="sendChat()">Send</button></div></div>
</div>
</div>
<script>
const api='/api';
function showPage(id){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById(id).classList.add('active');document.querySelectorAll('.sidebar a').forEach(a=>a.classList.remove('active'));event.target.classList.add('active');document.getElementById('page-title').textContent=id.charAt(0).toUpperCase()+id.slice(1);loadPage(id)}
async function loadPage(id){if(id==='children'){const r=await fetch(api+'/children');const d=await r.json();document.getElementById('children-list').innerHTML=d.map(c=>'<div class="card"><strong>'+c.name+'</strong> — Born '+c.dob+'</div>').join('')}
if(id==='milestones'){const r=await fetch(api+'/milestones');const d=await r.json();document.getElementById('milestones-list').innerHTML=d.map(m=>'<div class="card"><strong>'+m.title+'</strong><br><small style="color:#999">'+new Date(m.date).toLocaleDateString()+'</small><br>'+m.note+'</div>').join('')}
if(id==='memories'){const r=await fetch(api+'/memories');const d=await r.json();document.getElementById('memories-list').innerHTML=d.map(m=>'<div class="card"><strong>'+m.title+'</strong><br><small style="color:#999">'+new Date(m.date).toLocaleDateString()+'</small><br>'+m.content+'</div>').join('')}}
async function addChild(){const name=document.getElementById('child-name').value;const dob=document.getElementById('child-dob').value;if(!name)return;await fetch(api+'/children',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,dob})});document.getElementById('child-name').value='';loadPage('children')}
async function addMilestone(){const title=document.getElementById('milestone-title').value;const note=document.getElementById('milestone-note').value;if(!title)return;await fetch(api+'/milestones',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,note})});document.getElementById('milestone-title').value='';document.getElementById('milestone-note').value='';loadPage('milestones')}
async function addMemory(){const title=document.getElementById('memory-title').value;const content=document.getElementById('memory-content').value;if(!title)return;await fetch(api+'/memories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,content})});document.getElementById('memory-title').value='';document.getElementById('memory-content').value='';loadPage('memories')}
async function sendChat(){const input=document.getElementById('chat-input');const msg=input.value;if(!msg)return;input.value='';document.getElementById('chat-messages').innerHTML+='<div class="msg user">'+msg+'</div>';const resp=await fetch(api+'/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})});const reader=resp.body.getReader();const decoder=new TextDecoder();let aiMsg='';while(true){const{done,value}=await reader.read();if(done)break;const text=decoder.decode(value);for(const line of text.split('\\n')){if(line.startsWith('data: ')&&line!=='data: [DONE]'){try{aiMsg+=JSON.parse(line.slice(6))}catch{}}}document.getElementById('chat-messages').innerHTML='<div class="msg user">'+msg+'</div><div class="msg ai">'+aiMsg+'</div>';}}
loadPage('dashboard');
</script></body></html>`;
}

interface Env {
  PARENTLOG_KV: KVNamespace;
  DEEPSEEK_API_KEY: string;
}
