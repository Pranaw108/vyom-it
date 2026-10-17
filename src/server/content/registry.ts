import type { z } from 'astro/zod';
import {
  aboutSchema,
  caseStudySchema,
  engagementModelSchema,
  homeSchema,
  serviceSchema,
  settingsSchema,
  teamMemberSchema,
  testimonialSchema,
} from '../../lib/schemas/content';
import type { CollectionName } from '../../lib/content/collections';

// Validation rules per collection. Publishing is refused unless the data passes these.
export const COLLECTION_SCHEMAS: Record<CollectionName, z.ZodType> = {
  settings: settingsSchema,
  home: homeSchema,
  about: aboutSchema,
  services: serviceSchema,
  engagement: engagementModelSchema,
  work: caseStudySchema,
  team: teamMemberSchema,
  testimonials: testimonialSchema,
};
