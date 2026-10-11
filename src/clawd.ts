// Pixel scenes ported from the pomodoro mod (~/.claude/mods/pomodoro), with Clawd recoloured brand-blue.
// A scene is a 20x4 grid of colours (or undefined); the component draws it as crisp SVG rects.

export type Px = string | undefined;
export type Canvas = Px[][];
export const W = 20;
export const H = 4;

const BODY = "#3b82f6";
const INK = "#0b1020";
const LADY = "#e88fb5";

const blank = (): Canvas => Array.from({ length: H }, () => Array.from({ length: W }, (): Px => undefined));
const put = (c: Canvas, x: number, y: number, v: Px) => {
  if (y >= 0 && y < H && x >= 0 && x < W) c[y][x] = v;
};
function stamp(c: Canvas, art: string[], pal: (ch: string) => Px, x: number, y: number) {
  art.forEach((line, ay) => {
    for (let ax = 0; ax < line.length; ax++) if (line[ax] !== ".") put(c, x + ax, y + ay, pal(line[ax]));
  });
}

const CLAWD = [".OOOOO.", "OOkOkOO", ".OOOOO."];
const LEGS = [".O.O.O.", "..O.O.."];
const CLAWD_W = 7;

function clawd(c: Canvas, x: number, g: number, legsMove = true, body = BODY, bow = false, asleep = false) {
  // blinks every 12th step; asleep keeps the eyes shut
  const pal = (ch: string) => (ch === "k" ? (asleep || g % 12 === 11 ? body : INK) : body);
  stamp(c, CLAWD, pal, x, 0);
  stamp(c, [LEGS[legsMove ? g % 2 : 0]], pal, x, CLAWD.length);
  if (bow) put(c, x + 4, 0, "#d63a5a");
}

function working(f: number): Canvas {
  const g = Math.floor(f / 2);
  const c = blank();
  clawd(c, 1, g, false);
  stamp(c, [".gggg.", ".g..g.", "gggggg"], () => "#9a9a9a", 11, 1);
  put(c, 13, 2, g % 2 ? BODY : "#7fb069");
  put(c, 14, 2, g % 2 ? "#7fb069" : BODY);
  put(c, 9, 1 + (g % 2), BODY);
  return c;
}

function running(f: number): Canvas {
  const g = Math.floor(f / 2);
  const c = blank();
  for (let x = 0; x < W; x++) put(c, x, H - 1, (x + f) % 6 < 3 ? "#e8e8e8" : "#2d4f9e");
  const x = (f % (W + CLAWD_W)) - CLAWD_W;
  clawd(c, x, g);
  put(c, x - 2, 1, "#8a8a8a");
  put(c, x - 3, 1, "#8a8a8a");
  return c;
}

function coffee(f: number): Canvas {
  const g = Math.floor(f / 2);
  const c = blank();
  clawd(c, 1, g, false);
  const mx = g % 8 >= 6 ? 9 : 12;
  stamp(c, ["wDDw.", "wwwww", ".www."], (ch) => (ch === "D" ? "#4a2c17" : "#e8e4dc"), mx, 1);
  put(c, mx + 1 + (g % 2), 0, "#9a9a9a");
  return c;
}

function meeting(f: number): Canvas {
  const g = Math.floor(f / 2);
  const c = blank();
  const p = g % 20;
  const x = Math.max(12, 20 - p);
  clawd(c, 1, g, false);
  clawd(c, x, g, p < 8, LADY, true);
  if (p >= 10) {
    const hy = p % 2;
    put(c, 8, hy, "#e0457b");
    put(c, 10, hy, "#e0457b");
    put(c, 9, hy + 1, "#e0457b");
  }
  return c;
}

/** Idle: Clawd dozing at the desk, no animation. */
function asleep(): Canvas {
  const c = blank();
  clawd(c, 1, 0, false, BODY, false, true);
  stamp(c, [".gggg.", ".g..g.", "gggggg"], () => "#4b5563", 11, 1);
  put(c, 9, 0, "#7c8497");
  put(c, 10, 0, "#7c8497");
  return c;
}

const BREAKS = [running, coffee, meeting];

export function scene(phase: "focus" | "break", breaks: number, frame: number, running_: boolean): Canvas {
  if (!running_) return phase === "focus" ? asleep() : BREAKS[(breaks + 2) % 3](0);
  return phase === "focus" ? working(frame) : BREAKS[(breaks + 2) % 3](frame);
}
