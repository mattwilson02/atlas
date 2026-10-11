import { create } from "zustand";

/** Which overlay is open. Kept in a store so a key press anywhere can open it. */
export const useUi = create<{ help: boolean; switcher: boolean; pasting: boolean; toast: string }>(() => ({
  help: false,
  switcher: false,
  pasting: false,
  toast: "",
}));

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(message: string) {
  useUi.setState({ toast: message });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => useUi.setState({ toast: "" }), 1600);
}
