import type { Service } from './schemas/content';

// Icon tile colours per service category (tokens defined in global.css, both themes).
export const categoryTile: Record<Service['accent'], string> = {
  cobalt: 'bg-cat-cobalt-soft text-cat-cobalt',
  violet: 'bg-cat-violet-soft text-cat-violet',
  teal: 'bg-cat-teal-soft text-cat-teal',
  amber: 'bg-cat-amber-soft text-cat-amber',
};
