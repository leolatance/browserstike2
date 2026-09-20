import { CLASS_LABEL, SET_SIZE, resolveBuild, setProgress, type Build, type PlayerClass } from '@idle-strike/engine';

/**
 * "Entry" when a set is active, "Rifler · Entry 2/3" with the closest set in
 * progress, or "Rifler · sem conjunto" without class cards.
 */
export function classWithSetLabel(build: Build): string {
  const r = resolveBuild(build);
  if (r.sets.length) return r.sets.map((s) => CLASS_LABEL[s]).join(' + ');
  const progress = setProgress(build);
  let best: { cls: PlayerClass; n: number } | null = null;
  for (const [cls, n] of Object.entries(progress) as [PlayerClass, number][]) if (n > 0 && (!best || n > best.n)) best = { cls, n };
  if (!best) return `${CLASS_LABEL.rifler} · sem conjunto`;
  return `${CLASS_LABEL.rifler} · ${CLASS_LABEL[best.cls]} ${best.n}/${SET_SIZE}`;
}
