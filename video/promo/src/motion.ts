import {Easing, interpolate, spring} from 'remotion';

/**
 * One motion family, by role (research: NotebookLM 93326047…, #804):
 * type rises out of masks on expo-out, UI travels on quint, only small
 * badges overshoot, the camera glides. Never one fade-up for everything.
 */
export const ease = {
  expoOut: Easing.bezier(0.16, 1, 0.3, 1),
  quintInOut: Easing.bezier(0.83, 0, 0.17, 1),
  quintOut: Easing.bezier(0.22, 1, 0.36, 1),
  exitIn: Easing.bezier(0.55, 0, 1, 0.45),
};

export const springs = {
  badge: {stiffness: 170, damping: 12, mass: 0.6},
  ui: {stiffness: 140, damping: 22, mass: 0.9, overshootClamping: true},
  camera: {stiffness: 45, damping: 18, mass: 1.2, overshootClamping: true},
};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** 0→1 over `dur` frames starting at `start`, on an easing. */
export const progress = (frame: number, start: number, dur: number, easing = ease.expoOut) =>
  interpolate(frame, [start, start + dur], [0, 1], {...clamp, easing});

export const pop = (frame: number, fps: number, start: number) =>
  spring({frame: frame - start, fps, config: springs.badge});

export const glide = (frame: number, fps: number, start: number) =>
  spring({frame: frame - start, fps, config: springs.ui});

export const lerp = (t: number, a: number, b: number) => a + (b - a) * t;

/** Keeps a hold alive: a slow 1–3 % push across the shot. */
export const push = (frame: number, dur: number, amount = 0.025) =>
  interpolate(frame, [0, dur], [1, 1 + amount], clamp);
