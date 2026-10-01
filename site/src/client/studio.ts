// Runs a studio's missions in the browser: Explore → Predict → Check → Justify (docs/STUDIOS.md).
// All text arrives pre-rendered (HTML) from the server in #studio-data; nothing is fetched.
import { evaluate, type Attempt, type Check } from '../lib/checks';
import { asciiDigits, parseDecimal } from '../lib/fraction';
import type { FractionInput } from '../engines/fraction-input';
import '../engines/fraction-input';

/** Engines load on demand so each page ships only the code it uses. */
const ENGINES: Record<string, () => Promise<unknown>> = {
  'fraction-bars': () => import('../engines/fraction-bars'),
};

interface MissionData {
  id: string;
  engine: string;
  setup?: Record<string, unknown>;
  answer?: 'fraction' | 'integer' | 'decimal' | 'choice';
  check: Check;
  /** Rendered HTML of choice options, when check.type === 'choice'. */
  options?: string[];
  text: { title: string; prompt: string; hint?: string; success?: string; why?: string; model?: string; feedback: Record<string, string> };
}

interface StudioData {
  studioId: string;
  fmt: { digits: string; decimal: string };
  ui: Record<string, string>;
  missions: MissionData[];
}

interface Progress { [missionId: string]: { done: boolean; why?: string } }

const data: StudioData = JSON.parse(document.getElementById('studio-data')!.textContent!);
const root = document.getElementById('missions')!;
const storeKey = `kamangir:progress:${data.studioId}`;

function loadProgress(): Progress {
  try { return JSON.parse(localStorage.getItem(storeKey) || '{}'); } catch { return {}; }
}
function saveProgress(p: Progress) {
  try { localStorage.setItem(storeKey, JSON.stringify(p)); } catch { /* private mode: progress just isn't kept */ }
}

let progress = loadProgress();
let current = Math.max(0, data.missions.findIndex((m) => !progress[m.id]?.done));

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function renderTabs() {
  const nav = document.getElementById('mission-tabs')!;
  nav.innerHTML = '';
  data.missions.forEach((m, i) => {
    const b = el('button', 'mission-tab' + (progress[m.id]?.done ? ' done' : ''));
    b.type = 'button';
    b.innerHTML = `<span class="num">${data.fmt.digits[(i + 1) % 10]}</span> ${m.text.title}`;
    if (i === current) b.setAttribute('aria-current', 'step');
    b.addEventListener('click', () => { current = i; show(); });
    nav.append(b);
  });
}

async function show() {
  renderTabs();
  const m = data.missions[current];
  root.innerHTML = '';
  const card = el('section', 'mission');
  card.append(el('h2', '', m.text.title), el('p', 'prompt', m.text.prompt));

  await ENGINES[m.engine]?.();
  const engine = document.createElement(`kg-${m.engine}`) as HTMLElement & { config: unknown; state: Attempt['state'] };
  engine.dataset.digits = data.fmt.digits;
  engine.dataset.decimal = data.fmt.decimal;
  for (const [k, v] of Object.entries(data.ui)) if (k.startsWith('engine.')) engine.dataset[toDataKey(k.slice(7))] = v;
  engine.config = m.setup ?? {};
  engine.className = 'engine';
  card.append(engine);

  // Answer area
  let fracInput: FractionInput | undefined;
  let intInput: HTMLInputElement | undefined;
  let choice: number | null = null;
  if (m.answer === 'fraction') {
    const row = el('div', 'answer-row');
    row.append(el('span', '', data.ui.yourAnswer));
    fracInput = document.createElement('kg-fraction-input') as FractionInput;
    if ((m.setup as { whole?: boolean } | undefined)?.whole) fracInput.setAttribute('whole', '');
    fracInput.dataset.labelNumerator = data.ui.numerator;
    fracInput.dataset.labelDenominator = data.ui.denominator;
    fracInput.dataset.labelWhole = data.ui.whole;
    row.append(fracInput);
    card.append(row);
  } else if (m.answer === 'integer' || m.answer === 'decimal') {
    const row = el('div', 'answer-row');
    intInput = el('input', 'int-input');
    intInput.inputMode = 'numeric';
    intInput.setAttribute('aria-label', data.ui.yourAnswer);
    row.append(el('span', '', data.ui.yourAnswer), intInput);
    card.append(row);
  } else if (m.answer === 'choice' && m.options) {
    const group = el('div', 'choices');
    group.setAttribute('role', 'radiogroup');
    m.options.forEach((html, i) => {
      const b = el('button', 'choice', html);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');
      b.addEventListener('click', () => {
        choice = i;
        group.querySelectorAll('.choice').forEach((c, j) => c.setAttribute('aria-checked', String(j === i)));
      });
      group.append(b);
    });
    card.append(group);
  }

  const actions = el('div', 'actions');
  const checkBtn = el('button', 'primary', data.ui.check);
  checkBtn.type = 'button';
  actions.append(checkBtn);
  if (m.text.hint) {
    const hintBtn = el('button', 'secondary', data.ui.hint);
    hintBtn.type = 'button';
    hintBtn.addEventListener('click', () => { feedback.className = 'feedback hint'; feedback.innerHTML = m.text.hint!; });
    actions.append(hintBtn);
  }
  const feedback = el('div', 'feedback');
  feedback.setAttribute('role', 'status');
  card.append(actions, feedback);

  const justify = el('div', 'justify');
  card.append(justify);

  checkBtn.addEventListener('click', () => {
    const attempt: Attempt = {
      state: engine.state,
      fraction: fracInput?.value ?? null,
      integer: intInput && m.answer === 'integer' ? parseInt(asciiDigits(intInput.value), 10) : null,
      decimal: intInput && m.answer === 'decimal' ? parseDecimal(intInput.value, data.fmt.decimal) : null,
      choice,
    };
    if (attempt.integer !== null && Number.isNaN(attempt.integer)) attempt.integer = null;
    const r = evaluate(m.check, attempt);
    if (r.ok) {
      feedback.className = 'feedback ok';
      feedback.innerHTML = m.text.success ?? data.ui.correct;
      showJustify(m, justify);
    } else {
      feedback.className = 'feedback no';
      feedback.innerHTML = (r.code && (m.text.feedback[r.code] ?? data.ui[`fb.${r.code}`])) || data.ui.tryAgain;
    }
  });

  root.append(card);
}

function showJustify(m: MissionData, box: HTMLElement) {
  box.innerHTML = '';
  if (m.text.why) {
    box.append(el('p', 'why-q', m.text.why));
    const ta = el('textarea');
    ta.rows = 3;
    ta.value = progress[m.id]?.why ?? '';
    ta.setAttribute('aria-label', data.ui.explain);
    box.append(ta);
    if (m.text.model) {
      const reveal = el('button', 'secondary', data.ui.showModel);
      reveal.type = 'button';
      const model = el('p', 'model');
      model.hidden = true;
      model.innerHTML = m.text.model;
      reveal.addEventListener('click', () => { model.hidden = false; reveal.remove(); });
      box.append(reveal, model);
    }
    ta.addEventListener('change', () => { progress[m.id] = { done: true, why: ta.value }; saveProgress(progress); });
  }
  progress[m.id] = { ...progress[m.id], done: true };
  saveProgress(progress);
  renderTabs();
  if (current < data.missions.length - 1) {
    const next = el('button', 'primary', data.ui.next);
    next.type = 'button';
    next.addEventListener('click', () => { current++; show(); window.scrollTo({ top: 0 }); });
    box.append(next);
  } else {
    box.append(el('p', 'all-done', data.ui.allDone));
  }
}

/** "label-cell" → "labelCell" for dataset keys. */
function toDataKey(k: string) {
  return k.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
}

show();
