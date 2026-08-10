export const SERIES_IDS = [
  'bounce-in',
  'card-flip',
  'stagger-reveal',
  'drag-dismiss',
  'shared-element',
  'spring-settle',
] as const;

export type SeriesId = (typeof SERIES_IDS)[number];

export interface Series {
  id: SeriesId;
  label: string;
  blurb: string;
  plannedMembers: number;
}

export const SERIES: readonly Series[] = [
  {
    id: 'bounce-in',
    label: 'Bounce-in entrance',
    blurb: 'The same overshooting entrance in CSS keyframes, WAAPI, and motion.',
    plannedMembers: 3,
  },
  {
    id: 'card-flip',
    label: 'Card flip',
    blurb: 'A 3D flip authored in raw transforms, in Tailwind, and in motion.',
    plannedMembers: 3,
  },
  {
    id: 'stagger-reveal',
    label: 'Staggered list reveal',
    blurb: 'Per-item delay via CSS variables, a rAF loop, and motion variants.',
    plannedMembers: 3,
  },
  {
    id: 'drag-dismiss',
    label: 'Drag to dismiss',
    blurb: 'Pointer maths by hand, motion gestures, and velocity handoff.',
    plannedMembers: 3,
  },
  {
    id: 'shared-element',
    label: 'Shared element transition',
    blurb: 'Hand-rolled FLIP, the View Transitions API, and motion layoutId.',
    plannedMembers: 3,
  },
  {
    id: 'spring-settle',
    label: 'Spring settle',
    blurb: 'A spring written from scratch, approximated in linear(), and tuned in motion.',
    plannedMembers: 3,
  },
];
