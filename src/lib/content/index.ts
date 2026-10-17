import { z } from 'astro/zod';
import {
  aboutSchema,
  caseStudySchema,
  engagementModelSchema,
  homeSchema,
  serviceSchema,
  settingsSchema,
  teamMemberSchema,
  testimonialSchema,
  type CaseStudy,
  type Service,
  type TeamMember,
} from '../schemas/content';
import { settings as settingsSeed } from '../../data/settings';
import { home as homeSeed } from '../../data/home';
import { services as servicesSeed } from '../../data/services';
import { engagementModels as engagementSeed } from '../../data/engagement';
import { caseStudies as workSeed, testimonials as testimonialSeed } from '../../data/work';
import { about as aboutSeed, team as teamSeed } from '../../data/about';

// Content repository. Uses the admin's published content (written by scripts/pull-content.mjs
// before the build) and falls back to the seed files. Invalid content stops the build.
const generated = import.meta.glob<Record<string, unknown[]>>('../../data/generated/content.json', { eager: true, import: 'default' });
const published = Object.values(generated)[0];

function source(collection: string, seed: unknown, kind: 'single' | 'list'): unknown {
  if (!published || !(collection in published)) return seed;
  const items = published[collection] ?? [];
  return kind === 'single' ? (items[0] ?? seed) : items;
}

function parse<T extends z.ZodType>(schema: T, data: unknown, label: string): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid ${label} content:\n${issues}`);
  }
  return result.data;
}

const settings = parse(settingsSchema, source('settings', settingsSeed, 'single'), 'settings');
const home = parse(homeSchema, source('home', homeSeed, 'single'), 'home');
const about = parse(aboutSchema, source('about', aboutSeed, 'single'), 'about');
const services = parse(z.array(serviceSchema), source('services', servicesSeed, 'list'), 'services');
const engagementModels = parse(z.array(engagementModelSchema), source('engagement', engagementSeed, 'list'), 'engagement models');
const caseStudies = parse(z.array(caseStudySchema), source('work', workSeed, 'list'), 'case studies');
const testimonials = parse(z.array(testimonialSchema), source('testimonials', testimonialSeed, 'list'), 'testimonials');
const team = parse(z.array(teamMemberSchema), source('team', teamSeed, 'list'), 'team');

export const getAbout = () => about;
export const getTeam = (): TeamMember[] => [...team].sort((a, b) => a.order - b.order);
export const getSettings = () => settings;
export const getHome = () => home;
export const getServices = (): Service[] => services;
export const getService = (slug: string) => services.find((s) => s.slug === slug);
export const getEngagementModels = () => engagementModels;
export const getTestimonials = () => testimonials;
export const getCaseStudies = (): CaseStudy[] => caseStudies;

export function getFeaturedWork(limit = 3): CaseStudy[] {
  return caseStudies
    .filter((c) => c.featured)
    .sort((a, b) => a.featuredOrder - b.featuredOrder)
    .slice(0, limit);
}

export function getWorkForService(serviceSlug: string, limit = 3): CaseStudy[] {
  return caseStudies.filter((c) => c.services.includes(serviceSlug)).slice(0, limit);
}

// Insights stays out of navigation until at least one article is published (FR-096).
const posts: unknown[] = [];
export const hasInsights = () => posts.length > 0;

export function serviceName(slug: string): string {
  return services.find((s) => s.slug === slug)?.navLabel ?? slug;
}
