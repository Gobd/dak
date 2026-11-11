import { useEffect, useRef } from 'react';
import type { ClockSettings } from '../lib/settings';
import { dayFraction, dayKey, getSolarDay, type SolarDay } from '../lib/solar';
import type { ClockEvent } from '../lib/events';
import { drawEvents, faceRadius } from '../lib/draw-events';
import { hourLabel } from '../lib/hours';

const TAU = Math.PI * 2;
const angle = (fraction: number) => fraction * TAU - Math.PI / 2;

interface Palette {
  day: string;
  night: string;
  dayText: string;
  nightText: string;
  text: string;
  muted: string;
  accent: string;
  second: string;
  border: string;
  event: string;
  wipe: string;
}

function palette(element: HTMLElement): Palette {
  const style = getComputedStyle(element);
  const color = (name: string) => style.getPropertyValue(name).trim();
  return {
    day: color('--clock-day'),
    night: color('--clock-night'),
    dayText: color('--clock-day-text'),
    nightText: color('--clock-night-text'),
    text: color('--color-text'),
    muted: color('--color-text-muted'),
    accent: color('--clock-hand'),
    second: color('--clock-second'),
    border: color('--color-border'),
    event: color('--color-feature'),
    wipe: color('--clock-wipe'),
  };
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: ClockSettings,
  solar: SolarDay | null,
  colors: Palette,
  events: ClockEvent[],
) {
  const mode = settings.mode;
  ctx.clearRect(0, 0, width, height);
  ctx.font = `${Math.max(11, Math.min(17, width / 40))}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (mode === 'circle') {
    const x = width / 2;
    const y = height / 2;
    const radius = faceRadius(width, height, settings, events);
    ctx.font = `${Math.max(10, radius * 0.052)}px sans-serif`;
    const thickness = radius * 0.24;
    const ring = radius - thickness / 2;
    ctx.lineWidth = thickness;
    ctx.strokeStyle = solar ? colors.night : colors.border;
    ctx.beginPath();
    ctx.arc(x, y, ring, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = colors.day;
    for (const period of solar?.daylight ?? []) {
      ctx.beginPath();
      ctx.arc(x, y, ring, angle(period.start), angle(period.end));
      ctx.stroke();
    }
    for (let hour = 0; hour < 24; hour++) {
      const a = angle(hour / 24);
      const isDay = solar?.daylight.some(
        (period) => hour / 24 >= period.start && hour / 24 < period.end,
      );
      const ink = solar ? (isDay ? colors.dayText : colors.nightText) : colors.text;
      ctx.strokeStyle = ink;
      ctx.lineWidth = hour % 3 === 0 ? 2 : 1;
      line(
        ctx,
        x + Math.cos(a) * radius * 0.955,
        y + Math.sin(a) * radius * 0.955,
        x + Math.cos(a) * radius * 0.98,
        y + Math.sin(a) * radius * 0.98,
      );
      if (hour % (radius < 130 ? 3 : 2) === 0) {
        ctx.fillStyle = ink;
        ctx.fillText(
          hourLabel(hour, settings.hourLabels),
          x + Math.cos(a) * radius * 0.88,
          y + Math.sin(a) * radius * 0.88,
        );
      }
    }
    for (const event of solar?.events ?? []) {
      const a = angle(event.fraction);
      ctx.lineWidth = 3;
      ctx.strokeStyle = colors.accent;
      line(
        ctx,
        x + Math.cos(a) * (radius - thickness - 4),
        y + Math.sin(a) * (radius - thickness - 4),
        x + Math.cos(a) * radius,
        y + Math.sin(a) * radius,
      );
    }
  } else {
    const left = 0;
    const span = width;
    const top = 0;
    const barHeight = height;
    ctx.fillStyle = solar ? colors.night : colors.border;
    ctx.fillRect(left, top, span, barHeight);
    ctx.fillStyle = colors.day;
    for (const period of solar?.daylight ?? []) {
      ctx.fillRect(left + span * period.start, top, span * (period.end - period.start), barHeight);
    }
    for (let hour = 0; hour <= 24; hour++) {
      const x = left + (span * hour) / 24;
      const isDay = solar?.daylight.some(
        (period) => hour / 24 >= period.start && hour / 24 < period.end,
      );
      const ink = solar ? (isDay ? colors.dayText : colors.nightText) : colors.text;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      line(ctx, x, height - 42, x, height - 34);
      if (hour % (width < 600 ? 6 : 2) === 0) {
        ctx.fillStyle = ink;
        ctx.fillText(
          hourLabel(hour, settings.hourLabels),
          Math.max(12, Math.min(width - 12, x)),
          height - 18,
        );
      }
    }
    for (const event of solar?.events ?? []) {
      const x = left + span * event.fraction;
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 3;
      line(ctx, x, top - 4, x, top + barHeight + 2);
    }
  }
  drawEvents(ctx, width, height, settings, events, colors.event);
}

function drawHands(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: ClockSettings,
  now: Date,
  colors: Palette,
  events: ClockEvent[],
) {
  ctx.clearRect(0, 0, width, height);
  const fraction = dayFraction(now);
  const second = (now.getSeconds() + now.getMilliseconds() / 1000) / 60;
  ctx.lineCap = 'round';
  if (settings.mode === 'circle') {
    const x = width / 2;
    const y = height / 2;
    const radius = faceRadius(width, height, settings, events);
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 4;
    line(
      ctx,
      x,
      y,
      x + Math.cos(angle(fraction)) * radius * 0.78,
      y + Math.sin(angle(fraction)) * radius * 0.78,
    );
    if (settings.seconds) {
      ctx.strokeStyle = colors.second;
      ctx.lineWidth = 1.5;
      line(
        ctx,
        x,
        y,
        x + Math.cos(angle(second)) * radius * 0.71,
        y + Math.sin(angle(second)) * radius * 0.71,
      );
    }
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, TAU);
    ctx.fill();
  } else {
    const span = width;
    const x = span * fraction;
    if (settings.wipePast) {
      ctx.save();
      ctx.globalAlpha = settings.wipeOpacity / 100;
      ctx.fillStyle = settings.wipeColor ?? colors.wipe;
      ctx.fillRect(0, 0, x, height);
      ctx.restore();
    }
    if (settings.showTimeMarker) {
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 4;
      line(ctx, x, 0, x, height);
      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.moveTo(x, 14);
      ctx.lineTo(x - 8, 0);
      ctx.lineTo(x + 8, 0);
      ctx.fill();
    }
    if (settings.seconds && settings.showSecondsMarker) {
      const y = height * 0.86;
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1;
      line(ctx, 0, y, width, y);
      ctx.strokeStyle = colors.second;
      ctx.lineWidth = 2;
      const secondX = span * second;
      line(ctx, secondX, y - 6, secondX, y + 6);
    }
  }
}

export default function ClockCanvas({
  settings,
  dark,
  events,
}: {
  settings: ClockSettings;
  dark: boolean;
  events: ClockEvent[];
}) {
  const host = useRef<HTMLDivElement>(null);
  const face = useRef<HTMLCanvasElement>(null);
  const hands = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = host.current!;
    const background = face.current!;
    const foreground = hands.current!;
    const faceContext = background.getContext('2d');
    const handContext = foreground.getContext('2d');
    if (!faceContext || !handContext) return;
    let width = 0;
    let height = 0;
    let frame = 0;
    let timer = 0;
    let lastFrame = 0;
    let lastDay = '';
    let solar: SolarDay | null = null;
    let colors = palette(container);
    let dirty = true;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      // Limit backing-store pixels on high-DPI displays and inexpensive kiosks.
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      for (const canvas of [background, foreground]) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        canvas.getContext('2d')!.setTransform(ratio, 0, 0, ratio, 0, 0);
      }
      colors = palette(container);
      dirty = true;
    };
    const draw = () => {
      const now = new Date();
      const key = dayKey(now);
      if (key !== lastDay) {
        lastDay = key;
        solar =
          settings.latitude !== null && settings.longitude !== null
            ? getSolarDay(now, settings.latitude, settings.longitude)
            : null;
        dirty = true;
      }
      if (dirty) {
        drawFace(faceContext, width, height, settings, solar, colors, events);
        dirty = false;
      }
      drawHands(handContext, width, height, settings, now, colors, events);
    };
    const animate = (stamp: number) => {
      if (stamp - lastFrame >= 1000 / 30) {
        lastFrame = stamp;
        draw();
      }
      frame = requestAnimationFrame(animate);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
    const minuteTick = () => {
      draw();
      timer = window.setTimeout(minuteTick, 60000 - (Date.now() % 60000));
    };
    const start = () => {
      stop();
      if (document.hidden) return;
      resize();
      draw();
      if (settings.seconds) frame = requestAnimationFrame(animate);
      else timer = window.setTimeout(minuteTick, 60000 - (Date.now() % 60000));
    };
    const observer = new ResizeObserver(() => {
      resize();
      if (!document.hidden) draw();
    });
    observer.observe(container);
    // The shared dark-mode hook applies its class after child effects run.
    const themeObserver = new MutationObserver(() => {
      colors = palette(container);
      dirty = true;
      if (!document.hidden) draw();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    document.addEventListener('visibilitychange', start);
    start();
    return () => {
      stop();
      observer.disconnect();
      themeObserver.disconnect();
      document.removeEventListener('visibilitychange', start);
    };
  }, [
    settings.mode,
    settings.wipePast,
    settings.wipeColor,
    settings.wipeOpacity,
    settings.showTimeMarker,
    settings.showSecondsMarker,
    settings.hourLabels,
    settings.seconds,
    settings.latitude,
    settings.longitude,
    settings.dayColor,
    settings.nightColor,
    settings.handColor,
    settings.secondColor,
    settings.eventStyle,
    settings.eventPlacement,
    settings.eventColor,
    settings.showEventNames,
    events,
    dark,
  ]);

  return (
    <div
      ref={host}
      className="clock-canvas"
      role="img"
      aria-label={`${settings.mode === 'circle' ? 'Circular' : 'Linear'} 24-hour clock. Light sections show daylight; dark sections show night. Boundary marks show sunrise and sunset.${settings.mode === 'circle' || settings.showTimeMarker ? ' The long hand or full-height marker shows the current time.' : ''}${settings.mode === 'linear' && settings.wipePast ? ' Elapsed time is covered by a colored wipe.' : ''}${settings.seconds && (settings.mode === 'circle' || settings.showSecondsMarker) ? ' The short hand or lower marker shows seconds.' : ''}`}
    >
      <canvas ref={face} aria-hidden="true" />
      <canvas ref={hands} aria-hidden="true" />
    </div>
  );
}
