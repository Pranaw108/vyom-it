import { z } from 'astro/zod';
import {
  caseStudySchema,
  engagementModelSchema,
  homeSchema,
  serviceSchema,
  settingsSchema,
  testimonialSchema,
  type CaseStudy,
  type Service,
} from '../schemas/content';
import { settings as settingsSeed } from '../../data/settings';
import { home as homeSeed } from '../../data/home';
import { services as servicesSeed } from '../../data/services';
import { engagementModels as engagementSeed } from '../../data/engagement';
import { caseStudies as workSeed, testimonials as testimonialSeed } from '../../data/work';
import { about as aboutSeed, team as teamSeed } from '../../data/about';
import { aboutSchema, teamMemberSchema, type TeamMember } from '../schemas/content';

// Content repository. Today it reads the seed files; later it reads the admin's
// published-content export. Validation failures stop the build with a clear message.
function parse<T extends z.ZodType>(schema: T, data: unknown, label: string): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid ${label} content:\n${issues}`);
  }
  return result.data;
}

const settings = parse(settingsSchema, settingsSeed, 'settings');
const home = parse(homeSchema, homeSeed, 'home');
const services = parse(z.array(serviceSchema), servicesSeed, 'services');
const engagementModels = parse(z.array(engagementModelSchema), engagementSeed, 'engagement models');
const caseStudies = parse(z.array(caseStudySchema), workSeed, 'case studies');
const testimonials = parse(z.array(testimonialSchema), testimonialSeed, 'testimonials');

const about = parse(aboutSchema, aboutSeed, 'about');
const team = parse(z.array(teamMemberSchema), teamSeed, 'team');

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
