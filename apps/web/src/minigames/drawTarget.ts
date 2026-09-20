import { DUEL_TARGET, type Target } from './duelTarget';

export interface Mark {
  /** Normalised tap position (0–1). */
  x: number;
  y: number;
  /** Score the tap earned (drawn next to the mark). */
  score: number;
}

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * Draws a target (any variant) at time `now` on a w×h canvas. Shared by the
 * duel panel and the x1 mira board (which also draws the opponent's tap marks).
 */
export function drawTarget(ctx: CanvasRenderingContext2D, w: number, h: number, target: Target, now: number, visibleMs: number, marks: Mark[] = []): void {
  const since = now - target.spawnedAt;
  const r = DUEL_TARGET.RADIUS * Math.min(w, h);
  const x = target.x * w;
  const y = target.y * h;
  const accent = token('--accent');
  const ok = token('--ok');
  const text = token('--text-0');
  const font = getComputedStyle(document.documentElement).getPropertyValue('--font');
  const drawMarks = () => {
    for (const m of marks) {
      ctx.strokeStyle = token('--enemy');
      ctx.lineWidth = 2;
      const mx = m.x * w;
      const my = m.y * h;
      ctx.beginPath();
      ctx.moveTo(mx - 6, my - 6);
      ctx.lineTo(mx + 6, my + 6);
      ctx.moveTo(mx + 6, my - 6);
      ctx.lineTo(mx - 6, my + 6);
      ctx.stroke();
      ctx.fillStyle = token('--enemy');
      ctx.font = `700 11px ${font}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(m.score), mx + 8, my - 4);
    }
  };
  if (target.variant === 'timing') {
    // Sweeping bar with a green zone: tap when the cursor is inside.
    const bx = w * 0.08, bw = w * 0.84, by = h * 0.5, bh = Math.max(14, h * 0.12);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(bx, by - bh / 2, bw, bh);
    const zx = bx + (target.zoneAtMs / DUEL_TARGET.SWEEP_MS) * bw;
    const zw = (DUEL_TARGET.ZONE_MS / DUEL_TARGET.SWEEP_MS) * bw;
    ctx.fillStyle = ok;
    ctx.fillRect(zx - zw / 2, by - bh / 2, zw, bh);
    const cx = bx + Math.min(1, since / DUEL_TARGET.SWEEP_MS) * bw;
    ctx.fillStyle = accent;
    ctx.fillRect(cx - 2, by - bh, 4, bh * 2);
    if (target.label) {
      ctx.fillStyle = text;
      ctx.font = `600 ${Math.max(10, Math.min(w, h) * 0.07)}px ${font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(target.label, w / 2, by + bh + 6);
    }
    return;
  }
  if (target.variant === 'premira') {
    // Corner silhouette with a head-height mark; the enemy pops out after appearAtMs.
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x + r * 0.6, 0, w - x, h);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + r * 0.6, 0, 3, h);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r, y);
    ctx.stroke();
    if (since >= target.appearAtMs) {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--enemy').trim();
      ctx.beginPath();
      ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - r * 0.35, y + r * 0.4, r * 0.7, r * 1.2);
    }
    if (target.label) {
      ctx.fillStyle = text;
      ctx.font = `600 ${Math.max(10, Math.min(w, h) * 0.07)}px ${font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(target.label, x, y + r * 1.9);
    }
    return;
  }
  const life = Math.min(1, since / visibleMs);
  ctx.lineWidth = 2;
  ctx.strokeStyle = accent;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  // Shrinking ring = time left.
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(x, y, r * (1.6 - 0.6 * life), 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (target.label) {
    ctx.fillStyle = text;
    ctx.font = `600 ${Math.max(10, Math.min(w, h) * 0.07)}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(target.label, x, y + r * 1.7);
  }
  if (target.variant === 'flash') {
    // Flashed: white overlay fading over FLASH_MS.
    const a = Math.max(0, 1 - since / DUEL_TARGET.FLASH_MS);
    if (a > 0) {
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
  drawMarks();
}
