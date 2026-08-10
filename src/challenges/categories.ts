export const CATEGORY_IDS = [
  'css-transitions',
  'css-keyframes',
  'transforms-3d',
  'easing-timing',
  'tailwind-basics',
  'tailwind-custom',
  'waapi',
  'raf-tweening',
  'easing-math',
  'spring-physics',
  'scroll-driven',
  'motion-core',
  'motion-react-basics',
  'motion-orchestration',
  'motion-gestures',
  'motion-layout',
  'motion-presence',
  'svg-animation',
  'view-transitions',
  'performance',
  'accessibility',
  'interruption-state',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface Category {
  id: CategoryId;
  title: string;
  blurb: string;
  plannedCount: number;
}

export const CATEGORIES: readonly Category[] = [
  {
    id: 'css-transitions',
    title: 'Transitions & state changes',
    blurb: 'Property transitions, discrete transitions, and interrupting mid-flight.',
    plannedCount: 6,
  },
  {
    id: 'css-keyframes',
    title: '@keyframes & the animation shorthand',
    blurb: 'Declarative loops, fill modes, negative delays, and composition.',
    plannedCount: 6,
  },
  {
    id: 'transforms-3d',
    title: 'Transforms & 3D',
    blurb: 'Perspective, preserve-3d, transform-origin, and matrix ordering.',
    plannedCount: 6,
  },
  {
    id: 'easing-timing',
    title: 'Timing functions',
    blurb: 'cubic-bezier, steps(), linear(), and perceived velocity.',
    plannedCount: 6,
  },
  {
    id: 'tailwind-basics',
    title: 'Tailwind animation utilities',
    blurb: 'transition utilities and group, peer, and data-attribute driven motion.',
    plannedCount: 6,
  },
  {
    id: 'tailwind-custom',
    title: 'Custom Tailwind v4 animation',
    blurb: '@theme keyframes, @utility, CSS variables, and motion-safe variants.',
    plannedCount: 6,
  },
  {
    id: 'waapi',
    title: 'Web Animations API',
    blurb: 'element.animate, playback control, composite modes, and commitStyles.',
    plannedCount: 6,
  },
  {
    id: 'raf-tweening',
    title: 'requestAnimationFrame',
    blurb: 'Delta time, tween engines, cancellation, and avoiding layout thrash.',
    plannedCount: 7,
  },
  {
    id: 'easing-math',
    title: 'Easing math',
    blurb: 'Pure TypeScript: interpolation, easing curves, bezier solving, damping.',
    plannedCount: 6,
  },
  {
    id: 'spring-physics',
    title: 'Spring physics',
    blurb: 'Pure TypeScript: analytic and numeric springs, rest detection, velocity.',
    plannedCount: 5,
  },
  {
    id: 'scroll-driven',
    title: 'Scroll-linked animation',
    blurb: 'IntersectionObserver, scroll and view timelines, animation-range.',
    plannedCount: 6,
  },
  {
    id: 'motion-core',
    title: 'motion.dev, vanilla',
    blurb: 'animate(), sequences, stagger(), and scroll linking without React.',
    plannedCount: 5,
  },
  {
    id: 'motion-react-basics',
    title: 'motion.dev in React',
    blurb: 'motion components, variants, useAnimate, and motion values.',
    plannedCount: 7,
  },
  {
    id: 'motion-orchestration',
    title: 'Choreography',
    blurb: 'staggerChildren, propagation order, and dynamic variants.',
    plannedCount: 5,
  },
  {
    id: 'motion-gestures',
    title: 'Gestures',
    blurb: 'Hover, tap, drag constraints, velocity thresholds, and momentum.',
    plannedCount: 5,
  },
  {
    id: 'motion-layout',
    title: 'Layout animation',
    blurb: 'The layout prop, layoutId shared elements, and distortion correction.',
    plannedCount: 5,
  },
  {
    id: 'motion-presence',
    title: 'Exit animation',
    blurb: 'AnimatePresence, wait mode, popLayout, and fast-toggle robustness.',
    plannedCount: 5,
  },
  {
    id: 'svg-animation',
    title: 'SVG',
    blurb: 'Stroke dashing, path interpolation, offset-path, morphing, and filters.',
    plannedCount: 6,
  },
  {
    id: 'view-transitions',
    title: 'View Transitions API',
    blurb: 'startViewTransition, named transitions, and pseudo-element styling.',
    plannedCount: 4,
  },
  {
    id: 'performance',
    title: 'Making it smooth',
    blurb: 'Layout thrash, will-change hygiene, FLIP, and compositor discipline.',
    plannedCount: 5,
  },
  {
    id: 'accessibility',
    title: 'Motion accessibility',
    blurb: 'prefers-reduced-motion done properly, vestibular safety, and focus.',
    plannedCount: 5,
  },
  {
    id: 'interruption-state',
    title: 'Interruption & state',
    blurb: 'Reversibility, velocity handoff, state machines, and cancellation.',
    plannedCount: 5,
  },
];

export const TOTAL_PLANNED_CHALLENGES: number = CATEGORIES.reduce(
  (total, category) => total + category.plannedCount,
  0,
);
