import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Phase = "focus" | "break";
export const FOCUS = { min: 5, max: 90, step: 5 };
export const BREAK = { min: 1, max: 30, step: 1 };

const today = () => new Date().toISOString().slice(0, 10);

type State = {
  phase: Phase;
  /** Seconds left while paused; ignored while running (endsAt is the source of truth). */
  left: number;
  endsAt: number | null;
  focusMin: number;
  breakMin: number;
  done: number;
  breaks: number;
  day: string;

  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  setLength: (which: Phase, min: number) => void;
  /** Call on an interval; flips the phase when the countdown has run out. True when it just finished. */
  settle: () => boolean;
};

const secs = (s: Pick<State, "focusMin" | "breakMin">, p: Phase) => (p === "focus" ? s.focusMin : s.breakMin) * 60;
const other = (p: Phase): Phase => (p === "focus" ? "break" : "focus");

export const usePomodoro = create<State>()(
  persist(
    (set, get) => ({
      phase: "focus",
      left: 30 * 60,
      endsAt: null,
      focusMin: 30,
      breakMin: 5,
      done: 0,
      breaks: 0,
      day: today(),

      start: () => set((s) => (s.endsAt ? s : { endsAt: Date.now() + s.left * 1000 })),
      pause: () =>
        set((s) => (s.endsAt ? { endsAt: null, left: Math.max(1, Math.ceil((s.endsAt - Date.now()) / 1000)) } : s)),
      reset: () => set((s) => ({ endsAt: null, left: secs(s, s.phase) })),
      skip: () => set((s) => ({ phase: other(s.phase), endsAt: null, left: secs(s, other(s.phase)) })),
      setLength: (which, min) =>
        set((s) => {
          const next = { ...s, [which === "focus" ? "focusMin" : "breakMin"]: min };
          // an untouched countdown follows the setting; one under way keeps its time
          return s.phase === which && !s.endsAt && s.left === secs(s, which) ? { ...next, left: min * 60 } : next;
        }),
      settle: () => {
        const s = get();
        if (s.day !== today()) set({ day: today(), done: 0, breaks: 0 });
        if (!s.endsAt || Date.now() < s.endsAt) return false;
        const next = other(s.phase);
        set({
          phase: next,
          endsAt: null,
          left: secs(s, next),
          done: s.done + (s.phase === "focus" ? 1 : 0),
          breaks: s.breaks + (next === "break" ? 1 : 0),
        });
        return true;
      },
    }),
    { name: "atlas:pomodoro" },
  ),
);

export const clock = (total: number) =>
  `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
