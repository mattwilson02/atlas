import { useEffect, useState } from "react";
import { Minus, Pause, Play, Plus, RotateCcw, SkipForward } from "lucide-react";
import { BREAK, FOCUS, clock, usePomodoro } from "./pomodoroStore";
import { H, W, scene } from "./clawd";

const PX = 4;
const FRAME_MS = 250;

let audio: AudioContext | null = null;
/** Created inside a click handler so browsers allow sound later, when the timer ends. */
const unlockAudio = () => {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {
    /* no audio: the title and the widget still change */
  }
};
function chime() {
  if (!audio) return;
  [660, 880].forEach((hz, i) => {
    const o = audio!.createOscillator();
    const g = audio!.createGain();
    const t = audio!.currentTime + i * 0.22;
    o.frequency.value = hz;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g).connect(audio!.destination);
    o.start(t);
    o.stop(t + 1);
  });
}

/** Start/pause from a key press (a key press counts as the gesture browsers want before playing the chime). */
export function toggleTimer() {
  unlockAudio();
  const s = usePomodoro.getState();
  s.endsAt ? s.pause() : s.start();
}

function Stepper({ label, value, range, onChange }: { label: string; value: number; range: typeof FOCUS; onChange: (n: number) => void }) {
  const set = (n: number) => onChange(Math.min(range.max, Math.max(range.min, n)));
  return (
    <div className="pomo-step">
      <span className="eyebrow">{label}</span>
      <div>
        <button className="icon" aria-label={`Shorter ${label}`} onClick={() => set(value - range.step)}>
          <Minus size={13} />
        </button>
        <span>{value}m</span>
        <button className="icon" aria-label={`Longer ${label}`} onClick={() => set(value + range.step)}>
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

export function Pomodoro() {
  const s = usePomodoro();
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const running = s.endsAt !== null;

  // Ticks only while running; settle() also runs once on mount so a timer that ended while closed resolves.
  useEffect(() => {
    if (usePomodoro.getState().settle()) chime();
    if (!running) return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (usePomodoro.getState().settle()) chime();
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [running]);

  const left = running ? Math.max(0, Math.ceil((s.endsAt! - now) / 1000)) : s.left;
  const total = (s.phase === "focus" ? s.focusMin : s.breakMin) * 60;
  const pct = Math.min(100, ((total - left) / total) * 100);
  const frame = Math.floor(now / FRAME_MS);
  const canvas = scene(s.phase, s.breaks, frame, running);

  useEffect(() => {
    document.title = running ? `${clock(left)} · ${s.phase === "focus" ? "Focus" : "Break"} — Atlas` : "Atlas · Matt Wilson";
    return () => {
      document.title = "Atlas · Matt Wilson";
    };
  }, [left, running, s.phase]);

  return (
    <div className={`pomo ${s.phase} ${running ? "running" : ""}`}>
      <div className="pomo-main">
        <svg
          className="pomo-scene"
          width={W * PX}
          height={H * PX}
          viewBox={`0 0 ${W} ${H}`}
          shapeRendering="crispEdges"
          role="img"
          aria-label={running ? (s.phase === "focus" ? "Clawd is working" : "Clawd is on a break") : "Clawd is resting"}
        >
          {canvas.flatMap((row, y) => row.map((c, x) => (c ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={c} /> : null)))}
        </svg>
        <button className="pomo-read" title="Timer settings" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="eyebrow">{s.phase === "focus" ? "Focus" : "Break"}</span>
          <span className="pomo-clock">{clock(left)}</span>
        </button>
        <div className="pomo-actions">
          <button
            className="icon"
            aria-label={running ? "Pause" : "Start"}
            title={running ? "Pause" : "Start"}
            onClick={() => {
              unlockAudio();
              running ? s.pause() : s.start();
            }}
          >
            {running ? <Pause size={15} /> : <Play size={15} />}
          </button>
        </div>
      </div>
      <div className="pomo-bar" aria-hidden>
        <i style={{ width: `${pct}%` }} />
      </div>

      {open && (
        <div className="pomo-panel">
          <Stepper label="Focus" value={s.focusMin} range={FOCUS} onChange={(n) => s.setLength("focus", n)} />
          <Stepper label="Break" value={s.breakMin} range={BREAK} onChange={(n) => s.setLength("break", n)} />
          <div className="pomo-foot">
            <span className="muted">{s.done} focus {s.done === 1 ? "session" : "sessions"} today</span>
            <span>
              <button className="icon" title="Reset" aria-label="Reset" onClick={s.reset}>
                <RotateCcw size={13} />
              </button>
              <button className="icon" title="Skip to next phase" aria-label="Skip" onClick={s.skip}>
                <SkipForward size={13} />
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
