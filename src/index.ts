// parentlog-ai — Cloudflare Worker entry point

import {
  ChildProfileManager,
  MilestoneTracker,
  ScheduleManager,
  MemoryKeeper,
  ParentingAdvisor,
  type ChildProfile,
  type Milestone,
  type ScheduleEvent,
  type Memory,
} from './parent/tracker';

interface Env {
  PARENTLOG_KV: KVNamespace;
  __STATIC_CONTENT: { get: (key: string) => string | Promise<string | null> };
  DEEPSEEK_API_KEY: string;
  DEEPSEEK_MODEL: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function error(msg: string, status = 400): Response {
  return json({ error: msg }, status);
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  return (await request.json()) as Record<string, unknown>;
}

// ─── SSE Chat with DeepSeek ───────────────────────────────────────────────────

async function handleChat(request: Request, env: Env): Promise<Response> {
  const body = await readBody(request);
  const messages = body.messages as { role: string; content: string }[] | undefined;
  const childContext = body.childContext as string | undefined;

  if (!messages || !Array.isArray(messages)) {
    return error('messages array is required');
  }

  const systemPrompt = `You are ParentLog AI, a warm, knowledgeable, and supportive parenting companion. You provide evidence-based, age-appropriate parenting guidance with empathy and encouragement. You help parents track milestones, understand child development, and navigate the beautiful (and sometimes challenging) journey of raising children. Always be supportive, non-judgmental, and practical. If asked about medical emergencies or serious concerns, remind parents to consult their healthcare provider.${
    childContext ? `\n\nContext about the family's children:\n${childContext}` : ''
  }`;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(data: string) {
        controller.enqueue(encoder.encode(data));
      }

      try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: env.DEEPSEEK_MODEL || 'deepseek-chat',
            messages: [{ role: 'system', content: systemPrompt }, ...messages],
            stream: true,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          send(`data: ${JSON.stringify({ error: `DeepSeek API error: ${response.status}`, details: errText })}\n\n`);
          controller.close();
          return;
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              send('data: [DONE]\n\n');
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                send(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
      } catch (err) {
        send(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// ─── Children API ─────────────────────────────────────────────────────────────

async function handleChildren(request: Request, env: Env): Promise<Response> {
  const manager = new ChildProfileManager(env.PARENTLOG_KV);
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const id = url.searchParams.get('id');
    if (id) {
      const child = await manager.get(id);
      if (!child) return error('Child not found', 404);
      return json(child);
    }
    const children = await manager.list();
    return json(children.map(c => ({
      ...c,
      ageLabel: ChildProfileManager.getAgeLabel(c.birthDate),
      ageMonths: ChildProfileManager.getAgeMonths(c.birthDate),
    })));
  }

  if (request.method === 'POST') {
    const body = await readBody(request);
    const child = await manager.create({
      name: body.name as string,
      birthDate: body.birthDate as string,
      gender: body.gender as string | undefined,
      avatarColor: (body.avatarColor as string) || '#FBBF24',
      allergies: body.allergies as string[] | undefined,
      notes: body.notes as string | undefined,
    });
    return json(child, 201);
  }

  if (request.method === 'PUT') {
    const body = await readBody(request);
    const id = body.id as string;
    if (!id) return error('id is required');
    const updated = await manager.update(id, body as Partial<ChildProfile>);
    if (!updated) return error('Child not found', 404);
    return json(updated);
  }

  if (request.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return error('id query param required');
    const deleted = await manager.delete(id);
    if (!deleted) return error('Child not found', 404);
    return json({ success: true });
  }

  return error('Method not allowed', 405);
}

// ─── Milestones API ───────────────────────────────────────────────────────────

async function handleMilestones(request: Request, env: Env): Promise<Response> {
  const tracker = new MilestoneTracker(env.PARENTLOG_KV);
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const childId = url.searchParams.get('childId');
    if (!childId) return error('childId query param required');
    const milestones = await tracker.list(childId);
    const upcoming = MilestoneTracker.TYPICAL_MILESTONES;
    return json({ milestones, upcoming });
  }

  if (request.method === 'POST') {
    const body = await readBody(request);
    const milestone = await tracker.add({
      childId: body.childId as string,
      category: body.category as Milestone['category'],
      title: body.title as string,
      description: (body.description as string) || '',
      achievedDate: body.achievedDate as string,
      typicalAgeMonths: (body.typicalAgeMonths as number) || 0,
      notes: body.notes as string | undefined,
    });
    return json(milestone, 201);
  }

  if (request.method === 'DELETE') {
    const body = await readBody(request);
    const deleted = await tracker.delete(body.childId as string, body.milestoneId as string);
    if (!deleted) return error('Milestone not found', 404);
    return json({ success: true });
  }

  return error('Method not allowed', 405);
}

// ─── Schedule API ─────────────────────────────────────────────────────────────

async function handleSchedule(request: Request, env: Env): Promise<Response> {
  const scheduler = new ScheduleManager(env.PARENTLOG_KV);
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const childId = url.searchParams.get('childId');
    if (!childId) return error('childId query param required');
    const date = url.searchParams.get('date');
    const events = date
      ? await scheduler.listByDate(childId, date)
      : await scheduler.list(childId);
    return json(events);
  }

  if (request.method === 'POST') {
    const body = await readBody(request);
    const event = await scheduler.add({
      childId: body.childId as string,
      title: body.title as string,
      type: body.type as ScheduleEvent['type'],
      date: body.date as string,
      endTime: body.endTime as string | undefined,
      location: body.location as string | undefined,
      notes: body.notes as string | undefined,
      recurring: (body.recurring as ScheduleEvent['recurring']) || 'none',
    });
    return json(event, 201);
  }

  if (request.method === 'DELETE') {
    const body = await readBody(request);
    const deleted = await scheduler.delete(body.childId as string, body.eventId as string);
    if (!deleted) return error('Event not found', 404);
    return json({ success: true });
  }

  return error('Method not allowed', 405);
}

// ─── Memories API ─────────────────────────────────────────────────────────────

async function handleMemories(request: Request, env: Env): Promise<Response> {
  const keeper = new MemoryKeeper(env.PARENTLOG_KV);
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const childId = url.searchParams.get('childId');
    if (!childId) return error('childId query param required');
    const query = url.searchParams.get('q');
    const memories = query
      ? await keeper.search(childId, query)
      : await keeper.list(childId);
    return json(memories);
  }

  if (request.method === 'POST') {
    const body = await readBody(request);
    const memory = await keeper.add({
      childId: body.childId as string,
      title: body.title as string,
      content: body.content as string,
      date: body.date as string,
      tags: (body.tags as string[]) || [],
      mood: body.mood as Memory['mood'] | undefined,
      photoUrl: body.photoUrl as string | undefined,
    });
    return json(memory, 201);
  }

  if (request.method === 'DELETE') {
    const body = await readBody(request);
    const deleted = await keeper.delete(body.childId as string, body.memoryId as string);
    if (!deleted) return error('Memory not found', 404);
    return json({ success: true });
  }

  return error('Method not allowed', 405);
}

// ─── Advice API ───────────────────────────────────────────────────────────────

async function handleAdvice(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return error('Method not allowed', 405);

  const body = await readBody(request);
  const childId = body.childId as string;
  const topic = body.topic as string;
  let ageMonths = body.ageMonths as number | undefined;

  if (!childId) return error('childId is required');
  if (!topic) return error('topic is required');

  if (!ageMonths) {
    const manager = new ChildProfileManager(env.PARENTLOG_KV);
    const child = await manager.get(childId);
    if (child) {
      const birth = new Date(child.birthDate);
      const now = new Date();
      ageMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    } else {
      ageMonths = 6;
    }
  }

  const advice = ParentingAdvisor.getAdviceByAge(ageMonths, topic);
  advice.childId = childId;
  return json(advice);
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // API routes
    if (path === '/api/chat' && request.method === 'POST') return handleChat(request, env);
    if (path === '/api/children') return handleChildren(request, env);
    if (path === '/api/milestones') return handleMilestones(request, env);
    if (path === '/api/schedule') return handleSchedule(request, env);
    if (path === '/api/memories') return handleMemories(request, env);
    if (path === '/api/advice') return handleAdvice(request, env);

    // Serve static HTML for root
    if (path === '/' || path === '/index.html') {
      const html = env.__STATIC_CONTENT
        ? await env.__STATIC_CONTENT.get('app.html')
        : null;
      if (html) {
        return new Response(html, { headers: { 'Content-Type': 'text/html' } });
      }
      return new Response('ParentLog AI — Static assets not configured.', {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    return error('Not found', 404);
  },
};
