// parentlog-ai — Domain models and business logic

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChildProfile {
  id: string;
  name: string;
  birthDate: string; // ISO date
  gender?: string;
  avatarColor: string;
  allergies?: string[];
  notes?: string;
  createdAt: string;
}

export interface Milestone {
  id: string;
  childId: string;
  category: 'motor' | 'language' | 'social' | 'cognitive' | 'other';
  title: string;
  description: string;
  achievedDate: string;
  typicalAgeMonths: number;
  notes?: string;
}

export interface ScheduleEvent {
  id: string;
  childId: string;
  title: string;
  type: 'appointment' | 'activity' | 'routine' | 'reminder';
  date: string;
  endTime?: string;
  location?: string;
  notes?: string;
  recurring?: 'daily' | 'weekly' | 'monthly' | 'none';
}

export interface Memory {
  id: string;
  childId: string;
  title: string;
  content: string;
  date: string;
  tags: string[];
  mood?: 'joyful' | 'funny' | 'tender' | 'proud' | 'milestone';
  photoUrl?: string;
  createdAt: string;
}

export interface AdviceRequest {
  childId: string;
  topic: string;
  ageMonths?: number;
}

export interface AdviceResponse {
  childId: string;
  topic: string;
  advice: string;
  ageRange: string;
  tips: string[];
  generatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return crypto.randomUUID();
}

function ageInMonths(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
}

function ageLabel(birthDate: string): string {
  const months = ageInMonths(birthDate);
  if (months < 1) return 'Newborn';
  if (months < 12) return `${months} month${months > 1 ? 's' : ''}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}y ${rem}m` : `${years} year${years > 1 ? 's' : ''}`;
}

// ─── ChildProfile Manager ─────────────────────────────────────────────────────

export class ChildProfileManager {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  private key(id: string) {
    return `child:${id}`;
  }

  async list(): Promise<ChildProfile[]> {
    const list = await this.kv.list({ prefix: 'child:' });
    const children: ChildProfile[] = [];
    for (const key of list.keys) {
      const raw = await this.kv.get(key.name, 'json');
      if (raw) children.push(raw as ChildProfile);
    }
    return children.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async get(id: string): Promise<ChildProfile | null> {
    return (await this.kv.get(this.key(id), 'json')) as ChildProfile | null;
  }

  async create(data: Omit<ChildProfile, 'id' | 'createdAt'>): Promise<ChildProfile> {
    const profile: ChildProfile = { ...data, id: uid(), createdAt: new Date().toISOString() };
    await this.kv.put(this.key(profile.id), JSON.stringify(profile));
    return profile;
  }

  async update(id: string, data: Partial<ChildProfile>): Promise<ChildProfile | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, id: existing.id, createdAt: existing.createdAt };
    await this.kv.put(this.key(id), JSON.stringify(updated));
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.get(id);
    if (!existing) return false;
    await this.kv.delete(this.key(id));
    return true;
  }

  static getAgeLabel(birthDate: string): string {
    return ageLabel(birthDate);
  }

  static getAgeMonths(birthDate: string): number {
    return ageInMonths(birthDate);
  }
}

// ─── MilestoneTracker ─────────────────────────────────────────────────────────

export class MilestoneTracker {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  private listKey(childId: string) {
    return `milestones:${childId}`;
  }

  async list(childId: string): Promise<Milestone[]> {
    const raw = await this.kv.get(this.listKey(childId), 'json');
    return (raw as Milestone[] | null) ?? [];
  }

  async add(data: Omit<Milestone, 'id'>): Promise<Milestone> {
    const milestones = await this.list(data.childId);
    const milestone: Milestone = { ...data, id: uid() };
    milestones.push(milestone);
    milestones.sort((a, b) => new Date(b.achievedDate).getTime() - new Date(a.achievedDate).getTime());
    await this.kv.put(this.listKey(data.childId), JSON.stringify(milestones));
    return milestone;
  }

  async delete(childId: string, milestoneId: string): Promise<boolean> {
    const milestones = await this.list(childId);
    const filtered = milestones.filter(m => m.id !== milestoneId);
    if (filtered.length === milestones.length) return false;
    await this.kv.put(this.listKey(childId), JSON.stringify(filtered));
    return true;
  }

  static readonly CATEGORIES: Record<Milestone['category'], string> = {
    motor: 'Motor Skills',
    language: 'Language & Communication',
    social: 'Social & Emotional',
    cognitive: 'Cognitive',
    other: 'Other',
  };

  static readonly TYPICAL_MILESTONES: { months: number; title: string; category: Milestone['category'] }[] = [
    { months: 2, title: 'Social smile', category: 'social' },
    { months: 4, title: 'Holds head steady', category: 'motor' },
    { months: 6, title: 'Sits without support', category: 'motor' },
    { months: 6, title: 'Babbles consonant sounds', category: 'language' },
    { months: 9, title: 'Crawls', category: 'motor' },
    { months: 9, title: 'Responds to name', category: 'social' },
    { months: 12, title: 'First steps', category: 'motor' },
    { months: 12, title: 'Says "mama" or "dada"', category: 'language' },
    { months: 18, title: 'Walks independently', category: 'motor' },
    { months: 18, title: 'Says several words', category: 'language' },
    { months: 24, title: 'Two-word phrases', category: 'language' },
    { months: 24, title: 'Parallel play', category: 'social' },
    { months: 36, title: 'Three-word sentences', category: 'language' },
    { months: 36, title: 'Takes turns in games', category: 'social' },
    { months: 48, title: 'Tells stories', category: 'language' },
    { months: 48, title: 'Hops on one foot', category: 'motor' },
    { months: 60, title: 'Counts to 10', category: 'cognitive' },
  ];
}

// ─── ScheduleManager ──────────────────────────────────────────────────────────

export class ScheduleManager {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  private listKey(childId: string) {
    return `schedule:${childId}`;
  }

  async list(childId: string): Promise<ScheduleEvent[]> {
    const raw = await this.kv.get(this.listKey(childId), 'json');
    return (raw as ScheduleEvent[] | null) ?? [];
  }

  async listByDate(childId: string, date: string): Promise<ScheduleEvent[]> {
    const events = await this.list(childId);
    return events.filter(e => e.date.startsWith(date));
  }

  async add(data: Omit<ScheduleEvent, 'id'>): Promise<ScheduleEvent> {
    const events = await this.list(data.childId);
    const event: ScheduleEvent = { ...data, id: uid() };
    events.push(event);
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    await this.kv.put(this.listKey(data.childId), JSON.stringify(events));
    return event;
  }

  async delete(childId: string, eventId: string): Promise<boolean> {
    const events = await this.list(childId);
    const filtered = events.filter(e => e.id !== eventId);
    if (filtered.length === events.length) return false;
    await this.kv.put(this.listKey(childId), JSON.stringify(filtered));
    return true;
  }

  static readonly EVENT_TYPES: Record<ScheduleEvent['type'], string> = {
    appointment: 'Appointment',
    activity: 'Activity',
    routine: 'Routine',
    reminder: 'Reminder',
  };
}

// ─── MemoryKeeper ─────────────────────────────────────────────────────────────

export class MemoryKeeper {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  private listKey(childId: string) {
    return `memories:${childId}`;
  }

  async list(childId: string): Promise<Memory[]> {
    const raw = await this.kv.get(this.listKey(childId), 'json');
    return (raw as Memory[] | null) ?? [];
  }

  async add(data: Omit<Memory, 'id' | 'createdAt'>): Promise<Memory> {
    const memories = await this.list(data.childId);
    const memory: Memory = { ...data, id: uid(), createdAt: new Date().toISOString() };
    memories.push(memory);
    memories.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    await this.kv.put(this.listKey(data.childId), JSON.stringify(memories));
    return memory;
  }

  async delete(childId: string, memoryId: string): Promise<boolean> {
    const memories = await this.list(childId);
    const filtered = memories.filter(m => m.id !== memoryId);
    if (filtered.length === memories.length) return false;
    await this.kv.put(this.listKey(childId), JSON.stringify(filtered));
    return true;
  }

  async search(childId: string, query: string): Promise<Memory[]> {
    const memories = await this.list(childId);
    const q = query.toLowerCase();
    return memories.filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.content.toLowerCase().includes(q) ||
      m.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  static readonly MOODS: Record<Memory['mood'] & string, string> = {
    joyful: 'Joyful',
    funny: 'Funny',
    tender: 'Tender',
    proud: 'Proud',
    milestone: 'Milestone',
  };
}

// ─── ParentingAdvisor ─────────────────────────────────────────────────────────

export class ParentingAdvisor {
  static getAdviceByAge(ageMonths: number, topic: string): AdviceResponse {
    const ageRange = ParentingAdvisor.getAgeRange(ageMonths);
    const tips = ParentingAdvisor.getTipsForAge(ageMonths, topic);
    const advice = ParentingAdvisor.generateAdvice(ageMonths, topic);

    return {
      childId: '',
      topic,
      advice,
      ageRange,
      tips,
      generatedAt: new Date().toISOString(),
    };
  }

  private static getAgeRange(months: number): string {
    if (months <= 3) return '0-3 months (Newborn)';
    if (months <= 6) return '3-6 months (Infant)';
    if (months <= 12) return '6-12 months (Older Infant)';
    if (months <= 18) return '12-18 months (Young Toddler)';
    if (months <= 24) return '18-24 months (Older Toddler)';
    if (months <= 36) return '2-3 years (Early Preschool)';
    if (months <= 48) return '3-4 years (Preschool)';
    if (months <= 60) return '4-5 years (Pre-K)';
    return '5+ years (School Age)';
  }

  private static getTipsForAge(months: number, topic: string): string[] {
    const tipBank: Record<string, Record<string, string[]>> = {
      sleep: {
        '0-3': [
          'Newborns sleep 14-17 hours in 2-4 hour stretches',
          'Practice safe sleep: flat surface, no loose bedding',
          'Watch for sleepy cues: yawning, rubbing eyes, fussiness',
        ],
        '3-12': [
          'Most babies can sleep through the night by 6 months',
          'Establish a consistent bedtime routine',
          'Consider sleep training methods that fit your family',
        ],
        '12-36': [
          'Toddlers need 11-14 hours including naps',
          'Resistance to bedtime is normal — stay consistent',
          'Use a visual bedtime routine chart',
        ],
        '36+': [
          'Preschoolers need 10-13 hours of sleep',
          'Nightmares and fears are common — validate feelings',
          'Keep screens off 1 hour before bed',
        ],
      },
      feeding: {
        '0-3': [
          'Feed on demand, typically every 2-3 hours',
          'Watch for hunger cues: rooting, hand-to-mouth',
          'Growth spurts may increase feeding frequency',
        ],
        '3-12': [
          'Start solids around 6 months with single-ingredient foods',
          'Introduce one new food every 3-5 days to watch for allergies',
          'Breast milk or formula remains the primary nutrition source',
        ],
        '12-36': [
          'Offer a variety of textures and flavors',
          'Toddlers may become picky — keep offering without pressure',
          'Family meals encourage healthy eating habits',
        ],
        '36+': [
          'Involve children in meal preparation',
          'Teach food groups through colorful plates',
          'Model healthy eating behaviors',
        ],
      },
      behavior: {
        '0-3': [
          'Crying is communication — you cannot spoil a newborn',
          'Respond consistently to build secure attachment',
          'Take breaks when overwhelmed — it\'s okay to set baby down safely',
        ],
        '3-12': [
          'Baby-proof the environment instead of saying "no" constantly',
          'Use redirection rather than discipline at this age',
          'Celebrate small achievements to encourage learning',
        ],
        '12-36': [
          'Tantrums are normal — stay calm and present',
          'Use simple choices to give a sense of control',
          'Praise specific behaviors you want to see more of',
        ],
        '36+': [
          'Set clear, consistent limits with natural consequences',
          'Encourage emotional vocabulary: "I see you\'re feeling frustrated"',
          'Problem-solve together when conflicts arise',
        ],
      },
      development: {
        '0-3': [
          'Tummy time strengthens neck and shoulder muscles',
          'Talk, sing, and read to your baby every day',
          'High-contrast patterns support visual development',
        ],
        '3-12': [
          'Provide safe spaces for rolling, crawling, and exploring',
          'Respond to babbling as if having a conversation',
          'Stacking, banging, and dropping teach cause and effect',
        ],
        '12-36': [
          'Reading daily is the single best activity for language',
          'Encourage pretend play — it builds social cognition',
          'Simple puzzles and sorting toys support problem-solving',
        ],
        '36+': [
          'Ask open-ended questions to develop thinking skills',
          'Encourage drawing, building, and creative expression',
          'Playdates support social and emotional growth',
        ],
      },
      health: {
        '0-3': [
          'Follow the vaccination schedule from your pediatrician',
          'Track wet diapers (6+ per day) to ensure adequate feeding',
          'Schedule regular well-baby checkups',
        ],
        '3-12': [
          'Begin dental visits by the first tooth or first birthday',
          'Continue following the vaccination schedule',
          'Baby-proof thoroughly as mobility increases',
        ],
        '12-36': [
          'Toddler-proof for climbers — secure furniture to walls',
          'Teach hand-washing early as a fun activity',
          'Monitor speech development — mention concerns to your doctor',
        ],
        '36+': [
          'Teach sun safety and water safety rules',
          'Regular physical activity is essential',
          'Address fears and anxieties with patience and validation',
        ],
      },
    };

    const ageKey = months <= 3 ? '0-3' : months <= 12 ? '3-12' : months <= 36 ? '12-36' : '36+';
    return tipBank[topic]?.[ageKey] ?? [
      'Every child develops at their own pace',
      'Trust your instincts as a parent',
      'Consult your pediatrician with any concerns',
    ];
  }

  private static generateAdvice(months: number, topic: string): string {
    const ageRange = ParentingAdvisor.getAgeRange(months);
    return `For children in the ${ageRange} range, here is guidance on ${topic}:\n\n` +
      `Every child is unique and develops at their own pace. The suggestions provided ` +
      `are general guidelines based on developmental research. Always consult your ` +
      `pediatrician for personalized advice, especially if you have concerns about ` +
      `your child's development.\n\n` +
      `Remember: You're doing a great job. Parenting is one of the hardest and most ` +
      `important jobs in the world, and seeking information shows how much you care.`;
  }

  static readonly TOPICS = ['sleep', 'feeding', 'behavior', 'development', 'health', 'education', 'play', 'safety'];
}
