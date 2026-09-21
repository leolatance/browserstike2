#!/usr/bin/env node
/**
 * Creates the labels, the initial issues (from .github/ISSUE_DRAFTS) and,
 * with --project, the "Roadmap" GitHub Project. Needs `gh auth login`
 * (add `gh auth refresh -s project` for the project part).
 *
 *   node scripts/gh-bootstrap.mjs [--repo owner/name] [--project] [--dry]
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const repo = opt('--repo', 'leolatance/browserstike2');
const dry = flag('--dry');
const gh = (...a) => {
  console.log('$ gh', a.join(' '));
  return dry ? '' : execFileSync('gh', a, { encoding: 'utf8' }).trim();
};

const LABELS = {
  'good-first-issue': ['7057ff', 'Bom pra começar'],
  'help-wanted': ['008672', 'Precisa de alguém de fora'],
  design: ['d876e3', 'Decisão de design antes de código'],
  minigame: ['fbca04', 'Minigames (canvas, só recompensa)'],
  engine: ['0e8a16', 'packages/engine (determinístico)'],
  web: ['1d76db', 'apps/web'],
  online: ['5319e7', 'Fase 2+: Supabase'],
  supabase: ['3ecf8e', 'Migrações, functions, cron'],
  art: ['e99695', 'Arte: skins, cartas, patentes, mapas'],
  balance: ['b60205', 'Mexe em fórmula: balance obrigatório'],
  progression: ['c2e0c6', 'XP, cartas, pó'],
  pinned: ['000000', 'Issue fixada'],
};

for (const [name, [color, description]] of Object.entries(LABELS)) gh('label', 'create', name, '--repo', repo, '--color', color, '--description', description, '--force');

const dir = join(process.cwd(), '.github', 'ISSUE_DRAFTS');
const created = [];
for (const file of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
  const src = readFileSync(join(dir, file), 'utf8');
  const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) continue;
  const front = Object.fromEntries(m[1].split('\n').map((l) => l.split(/:\s(.*)/s)).map(([k, v]) => [k.trim(), (v ?? '').trim()]));
  const title = front.title.replace(/^"|"$/g, '');
  const labels = (front.labels ?? '').replace(/[[\]]/g, '').split(',').map((s) => s.trim()).filter(Boolean);
  const url = gh('issue', 'create', '--repo', repo, '--title', title, '--label', labels.join(','), '--body', m[2].trim());
  created.push({ title, url, pinned: front.pinned === 'true' });
  if (front.pinned === 'true' && url) gh('issue', 'pin', url, '--repo', repo);
}

if (flag('--project')) {
  const owner = repo.split('/')[0];
  const out = gh('project', 'create', '--owner', owner, '--title', 'Roadmap', '--format', 'json');
  const number = dry ? 0 : JSON.parse(out).number;
  for (const it of created) gh('project', 'item-add', String(number), '--owner', owner, '--url', it.url);
  console.log(`Project Roadmap #${number}: mova as issues pras colunas (Design / Pronto pra codar / Em andamento / Feito) no site.`);
}
console.log(`\n${created.length} issues criadas.`);
