import { useEffect, useState } from 'react';

interface TimerProps {
  running: boolean;
  /** Resets the timer when this value changes. */
  resetKey: unknown;
}

export function useTimer({ running, resetKey }: TimerProps) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    setSeconds(0);
  }, [resetKey]);

  return seconds;
}

export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
