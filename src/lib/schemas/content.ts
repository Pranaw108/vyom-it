import { z } from 'astro/zod';
import { ICON_NAMES } from '../icons';

// One schema per content type. The admin panel and the build use the same definitions.

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens');
const httpsUrl = z.url().startsWith('https://');

export const iconName = z.enum(ICON_NAMES);
export type IconName = z.infer<typeof iconName>;

export const faqSchema = z.object({
  question: z.string().min(5),
  // Every FAQ needs a real answer before it can be published (FR-159).
  answer: z.string().min(20),
});

export const settingsSchema = z.object({
  companyName: z.string().min(2),
  tagline: z.string(),
  description: z.string().max(160),
  email: z.email().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().regex(/^\d{10,15}$/, 'Digits only, with country code').nullable(),
  bookingUrl: httpsUrl.nullable(),
  address: z.object({ line: z.string(), mapUrl: httpsUrl }).nullable(),
  businessHours: z.string(),
  replyTime: z.string(),
  // Full profile URLs only, never a bare domain (FR-154).
  social: z.array(z.object({
    label: z.string(),
    url: httpsUrl.refine((u) => new URL(u).pathname.length > 1, 'Link to the profile, not the home page'),
  })),
});

export const serviceSchema = z.object({
  slug,
  name: z.string(),
  navLabel: z.string(),
  icon: iconName,
  accent: z.enum(['cobalt', 'violet', 'teal', 'amber']),
  outcome: z.string().max(110),
  summary: z.string(),
  examples: z.array(z.string()).length(3),
  hero: z.object({ headline: z.string(), intro: z.string() }),
  problems: z.array(z.object({ title: z.string(), body: z.string() })).min(3).max(4),
  deliverables: z.array(z.object({ title: z.string(), body: z.string() })).min(4),
  processNotes: z.array(z.string()).length(5),
  technologies: z.array(z.object({ group: z.string(), items: z.array(z.string()) })),
  faqs: z.array(faqSchema).min(3),
  disclaimer: z.string().optional(),
  seo: z.object({ title: z.string().max(60), description: z.string().max(160) }),
});

export const engagementModelSchema = z.object({
  name: z.string().min(2),
  bestFor: z.string().min(3),
  description: z.string().min(10),
  points: z.array(z.string().min(2)).min(1),
});

const titledPoint = z.object({ title: z.string(), body: z.string() });

const caseStudyBase = {
  slug,
  title: z.string(),
  summary: z.string().max(140),
  industry: z.string(),
  services: z.array(slug).min(1),
  cover: z.enum(['clinic', 'saas', 'storefront']),
  featured: z.boolean(),
  featuredOrder: z.number().int(),
  duration: z.string(),
  challenge: z.string(),
  approach: z.array(titledPoint).min(2),
  solution: z.array(titledPoint).min(2),
  technologies: z.array(z.string()).min(1),
  seo: z.object({ title: z.string().max(60), description: z.string().max(160) }),
};

export const caseStudySchema = z.discriminatedUnion('type', [
  z.object({
    ...caseStudyBase,
    type: z.literal('concept'),
    // Concept work states goals in words only; numbers would read as real results (FR-037).
    goals: z.array(z.string().regex(/^[^0-9%]*$/, 'Concept goals cannot contain numbers')).min(2),
  }),
  z.object({
    ...caseStudyBase,
    type: z.literal('client'),
    clientName: z.string().nullable(),
    // A client project cannot be published without written permission (FR-038).
    permission: z.object({ approvedBy: z.string(), date: z.string(), showName: z.boolean() }),
    // Every reported number needs a source (FR-159).
    outcomes: z.array(z.object({ label: z.string(), value: z.string(), source: z.string().min(5) })),
  }),
]);

export const testimonialSchema = z.object({
  quote: z.string().min(20),
  name: z.string(),
  role: z.string(),
  company: z.string(),
  consentDate: z.string(),
  sourceUrl: httpsUrl.nullable(),
});

export const homeSchema = z.object({
  hero: z.object({
    eyebrow: z.string(),
    headline: z.string(),
    intro: z.string(),
    primaryCta: z.object({ label: z.string(), href: z.string() }),
    secondaryCta: z.object({ label: z.string(), href: z.string() }),
  }),
  differentiators: z.array(z.object({ icon: iconName, title: z.string(), body: z.string() })).min(3).max(4),
  process: z.array(z.object({ icon: iconName, title: z.string(), body: z.string() })).length(5),
  capabilities: z.array(z.object({ group: z.string(), items: z.array(z.string()) })),
  faqs: z.array(faqSchema).min(3),
});

export const aboutSchema = z.object({
  intro: z.object({ headline: z.string(), body: z.string() }),
  story: z.array(z.string()).min(1),
  mission: z.string(),
  vision: z.string(),
  values: z.array(z.object({ icon: iconName, title: z.string(), body: z.string() })).min(3).max(5),
});

export const teamMemberSchema = z.object({
  slug,
  name: z.string(),
  designation: z.string(),
  department: z.enum(['Leadership', 'Engineering', 'Design', 'Marketing']),
  bio: z.string().max(280),
  skills: z.array(z.string()).max(6),
  photo: z.string().nullable(),
  photoAlt: z.string().nullable(),
  links: z.array(z.object({ label: z.string(), url: httpsUrl })),
  order: z.number().int(),
  // No profile is published without recorded consent (FR-054).
  consent: z.object({ date: z.string().min(8), evidence: z.string().min(5) }),
});

export type Settings = z.infer<typeof settingsSchema>;
export type About = z.infer<typeof aboutSchema>;
export type TeamMember = z.infer<typeof teamMemberSchema>;
export type Service = z.infer<typeof serviceSchema>;
export type EngagementModel = z.infer<typeof engagementModelSchema>;
export type CaseStudy = z.infer<typeof caseStudySchema>;
export type Testimonial = z.infer<typeof testimonialSchema>;
export type Home = z.infer<typeof homeSchema>;
export type Faq = z.infer<typeof faqSchema>;
