// Build-time loading of studios, their locale text, and the concept graph.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import type { Check } from './checks';
import type { LocaleCode } from '../i18n/locales';

// Resolved from the site/ working directory: import.meta.url points into the build output during `astro build`.
const CONTENT = resolve(process.cwd(), '../content') + '/';

export interface MissionDef {
  id: string;
  setup?: Record<string, unknown>;
  answer?: 'fraction' | 'integer' | 'decimal' | 'choice';
  check: Check;
}

export interface StudioDef {
  id: string;
  engine: string;
  strand: string;
  concepts: string[];
  order: number;
  missions: MissionDef[];
}

export interface MissionText {
  title: string;
  prompt: string;
  hint?: string;
  success?: string;
  why?: string;
  model?: string;
  feedback?: Record<string, string>;
}

export interface StudioText {
  _status?: 'draft' | 'reviewed';
  title: string;
  summary: string;
  guide: string[];
  /** Engine labels for this studio (aria-labels, button names), passed to the engine as data-* attributes. */
  engine?: Record<string, string>;
  missions: Record<string, MissionText>;
}

export function loadStudios(): StudioDef[] {
  const dir = CONTENT + 'studios/';
  if (!existsSync(dir)) throw new Error(`No studios directory at ${dir}`);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => parse(readFileSync(dir + f, 'utf8')) as StudioDef)
    .sort((a, b) => a.strand.localeCompare(b.strand) || a.order - b.order);
}

/** Locale text for a studio; drafts fall back to fa-IR (fa-AF, ps) or en, and `fallback` says so. */
export function loadStudioText(id: string, locale: LocaleCode): { text: StudioText; fallback: boolean } {
  const file = (l: string) => `${CONTENT}locales/${l}/studios/${id}.json`;
  if (existsSync(file(locale))) return { text: JSON.parse(readFileSync(file(locale), 'utf8')), fallback: false };
  const alt = locale === 'en' ? 'en' : 'fa-IR';
  if (!existsSync(file(alt))) throw new Error(`Studio ${id} has no ${alt} text`);
  return { text: JSON.parse(readFileSync(file(alt), 'utf8')), fallback: true };
}

// ---- concept graph: which grade teaches a studio's concepts in each curriculum ----

interface Concept { id: string; align?: Record<string, string[] | null> }
let conceptIndex: Map<string, Concept> | undefined;

function concepts(): Map<string, Concept> {
  if (!conceptIndex) {
    conceptIndex = new Map();
    const dir = CONTENT + 'concepts/';
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.yaml')))
      for (const c of parse(readFileSync(dir + f, 'utf8')) as Concept[]) conceptIndex.set(c.id, c);
  }
  return conceptIndex;
}

/** Grade from an entry key, e.g. "iran:G05_riazi_panjom:2:abc123" → 5, "uk:UK_Y04:…" → 4. */
function gradeOfKey(key: string): number | null {
  const m = key.match(/:(?:AF_)?G(\d+)|:UK_Y(\d+)/);
  return m ? Number(m[1] ?? m[2]) : null;
}

export type Curriculum = 'iran' | 'af' | 'uk';

/** Lowest grade (Iran/AF) or Year (UK) at which any of the concepts is taught; null if not taught there. */
export function gradeFor(conceptIds: string[], cur: Curriculum): number | null {
  const grades = conceptIds.flatMap((id) => (concepts().get(id)?.align?.[cur] ?? []).map(gradeOfKey)).filter((g): g is number => g !== null);
  return grades.length ? Math.min(...grades) : null;
}

export function assertConceptsExist(studio: StudioDef): void {
  for (const id of studio.concepts) if (!concepts().has(id)) throw new Error(`Studio ${studio.id}: unknown concept ${id}`);
}
