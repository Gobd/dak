import type { ClockSettings } from './settings';
import { MAX_EVENT_LANES, type ClockEvent } from './events.ts';
import { labelBox, labelFits, type LabelBox } from './label-layout.ts';
import { linearHourFontSize } from './hours.ts';

const TAU = Math.PI * 2;
const angle = (fraction: number) => fraction * TAU - Math.PI / 2;
const eventStep = (radius: number, names: boolean) =>
  Math.max(4, names ? Math.min(26, radius * 0.065) : radius * 0.027);
const eventGap = (radius: number, names: boolean) =>
  names ? Math.max(8, Math.min(12, radius * 0.025)) + 4 : 4;

function eventLabel(
  ctx: CanvasRenderingContext2D,
  title: string,
  x: number,
  y: number,
  rotation: number,
  fontSize: number,
  occupied: LabelBox[],
) {
  const styles = getComputedStyle(ctx.canvas);
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = title.length > 18 ? `${title.slice(0, 17)}…` : title;
  const box = labelBox(x, y, Math.min(110, ctx.measureText(label).width), fontSize + 4, rotation);
  if (!labelFits(box, occupied, ctx.canvas.clientWidth, ctx.canvas.clientHeight)) {
    ctx.restore();
    return;
  }
  occupied.push(box);
  ctx.strokeStyle = styles.getPropertyValue('--color-surface').trim();
  ctx.lineWidth = 3;
  ctx.strokeText(label, 0, 0, 110);
  ctx.fillStyle = styles.getPropertyValue('--color-text').trim();
  ctx.fillText(label, 0, 0, 110);
  ctx.restore();
}

export function faceRadius(
  width: number,
  height: number,
  settings: ClockSettings,
  events: ClockEvent[],
): number {
  const radius = Math.max(1, Math.min(width, height) / 2 - 1);
  if (settings.eventStyle === 'none' || settings.eventPlacement !== 'outside' || !events.length)
    return radius;
  const lanes = Math.min(MAX_EVENT_LANES, Math.max(...events.map((event) => event.lane)) + 1);
  return Math.max(
    1,
    radius -
      lanes * eventStep(radius, settings.showEventNames) -
      eventGap(radius, settings.showEventNames),
  );
}

export function drawEvents(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: ClockSettings,
  events: ClockEvent[],
  fallbackColor: string,
): void {
  if (settings.eventStyle === 'none') return;
  const outer = Math.max(1, Math.min(width, height) / 2 - 1);
  const radius = faceRadius(width, height, settings, events);
  const step = eventStep(outer, settings.showEventNames);
  const occupied: LabelBox[] = [];
  ctx.save();
  ctx.lineCap = 'butt';
  for (const event of events) {
    if (event.lane >= MAX_EVENT_LANES) continue;
    const color = settings.eventColor ?? event.color ?? fallbackColor;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = settings.showEventNames ? 3 : Math.max(2, step * 0.6);
    // Full-day outlines are deliberately less dominant than timed-event bands.
    ctx.globalAlpha = event.allDay ? 0.55 : 1;
    if (settings.mode === 'circle') {
      const r =
        settings.eventPlacement === 'outside'
          ? radius + eventGap(outer, settings.showEventNames) + step * (event.lane + 0.5)
          : radius * 0.73 - step * (event.lane + 0.5);
      if (r <= 0) continue;
      const x = width / 2;
      const y = height / 2;
      if (settings.eventStyle === 'dot' && !event.allDay) {
        ctx.beginPath();
        ctx.arc(
          x + Math.cos(angle(event.start)) * r,
          y + Math.sin(angle(event.start)) * r,
          settings.showEventNames ? 2.5 : Math.max(2, step * 0.4),
          0,
          TAU,
        );
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, r, angle(event.start), angle(Math.max(event.end, event.start + 1 / 1440)));
        ctx.stroke();
      }
      for (const fraction of [event.continuesBefore ? 0 : null, event.continuesAfter ? 1 : null]) {
        if (fraction === null) continue;
        const a = angle(fraction);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3));
        ctx.lineTo(x + Math.cos(a) * (r + 3), y + Math.sin(a) * (r + 3));
        ctx.stroke();
      }
      const fontSize = Math.max(8, Math.min(12, outer * 0.025));
      if (settings.showEventNames && step >= fontSize + 8) {
        const mid =
          settings.eventStyle === 'dot' && !event.allDay
            ? event.start
            : (event.start + event.end) / 2;
        const a = angle(mid);
        const labelRadius = r - step * 0.5;
        const rotation = a + Math.PI / 2 + (mid > 0.25 && mid < 0.75 ? Math.PI : 0);
        eventLabel(
          ctx,
          event.title,
          x + Math.cos(a) * labelRadius,
          y + Math.sin(a) * labelRadius,
          rotation,
          fontSize,
          occupied,
        );
      }
    } else {
      const trackStep = settings.showEventNames
        ? Math.max(12, Math.min(24, height * 0.04))
        : Math.max(5, Math.min(12, height * 0.025));
      const y =
        settings.eventPlacement === 'inside'
          ? 16 + trackStep * (event.lane + 0.5)
          : height -
            Math.max(52, linearHourFontSize(width, height, settings.hourLabelScale) * 2.5) -
            trackStep * (event.lane + 0.5);
      if (y < 4 || y > height - 4) continue;
      ctx.lineWidth = settings.showEventNames ? 3 : Math.max(2, trackStep * 0.6);
      if (settings.eventStyle === 'dot' && !event.allDay) {
        ctx.beginPath();
        ctx.arc(
          width * event.start,
          y,
          settings.showEventNames ? 2.5 : Math.max(2, trackStep * 0.4),
          0,
          TAU,
        );
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(width * event.start, y);
        ctx.lineTo(width * Math.max(event.end, event.start + 1 / 1440), y);
        ctx.stroke();
      }
      for (const x of [event.continuesBefore ? 2 : null, event.continuesAfter ? width - 2 : null]) {
        if (x === null) continue;
        ctx.beginPath();
        ctx.moveTo(x, y - 4);
        ctx.lineTo(x, y + 4);
        ctx.stroke();
      }
      if (settings.showEventNames && trackStep >= 23) {
        const mid =
          settings.eventStyle === 'dot' && !event.allDay
            ? event.start
            : (event.start + event.end) / 2;
        eventLabel(
          ctx,
          event.title,
          Math.max(56, Math.min(width - 56, width * mid)),
          y + (settings.eventPlacement === 'inside' ? 12 : -12),
          0,
          11,
          occupied,
        );
      }
    }
  }
  ctx.restore();
}
