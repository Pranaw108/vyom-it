import { ICON_NAMES } from '../icons';
import type { FieldSpec, Option } from './fields';

// Every editable content type: how it is edited, keyed and who may change it.
// Browser-safe (no Zod); the server attaches validation in src/server/content/registry.ts.

export type CollectionName = 'settings' | 'home' | 'about' | 'services' | 'engagement' | 'work' | 'team' | 'testimonials';

export interface CollectionDef {
  name: CollectionName;
  label: string;
  description: string;
  kind: 'single' | 'list';
  fields: FieldSpec[];
  /** Permission needed to edit, beyond content.edit. */
  editPermission: 'content.edit' | 'team.edit' | 'settings.edit';
  /** Builds the entry key for list items. */
  keyOf?: (data: Record<string, unknown>) => string;
  titleOf: (data: Record<string, unknown>) => string;
}

export const slugify = (value: string) =>
  value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

const options = (values: readonly string[], labels?: Record<string, string>): Option[] => values.map((v) => ({ value: v, label: labels?.[v] ?? v }));
const icons = options(ICON_NAMES);
const titleBody = (titleLabel = 'Title'): FieldSpec[] => [
  { type: 'text', name: 'title', label: titleLabel },
  { type: 'textarea', name: 'body', label: 'Text', rows: 3 },
];
const faqs: FieldSpec = {
  type: 'list',
  name: 'faqs',
  label: 'Frequently asked questions',
  itemLabel: 'Question',
  fields: [
    { type: 'text', name: 'question', label: 'Question' },
    { type: 'textarea', name: 'answer', label: 'Answer', rows: 3, hint: 'Every question needs a real answer before it can be published.' },
  ],
};
const seo: FieldSpec = {
  type: 'group',
  name: 'seo',
  label: 'Search engine details',
  fields: [
    { type: 'text', name: 'title', label: 'Page title', hint: 'Up to 60 characters. The company name is added automatically.' },
    { type: 'textarea', name: 'description', label: 'Description', rows: 2, hint: 'Up to 160 characters, shown under the title in search results.' },
  ],
};
const serviceSlugs = 'website-development, mobile-app-development, ui-ux-design, digital-marketing-seo';

export const COLLECTIONS: CollectionDef[] = [
  {
    name: 'settings',
    label: 'Site settings',
    description: 'Company name, contact details, reply time and social links.',
    kind: 'single',
    editPermission: 'settings.edit',
    titleOf: () => 'Site settings',
    fields: [
      { type: 'text', name: 'companyName', label: 'Company name', hint: 'Used across the whole site, so a rebrand is one change.' },
      { type: 'text', name: 'tagline', label: 'Tagline' },
      { type: 'textarea', name: 'description', label: 'Short description', rows: 2, hint: 'Up to 160 characters. Used in the footer and search results.' },
      { type: 'email', name: 'email', label: 'Public email address', nullable: true },
      { type: 'text', name: 'phone', label: 'Public phone number', nullable: true, hint: 'With country code, e.g. +91 98765 43210' },
      { type: 'text', name: 'whatsapp', label: 'WhatsApp number', nullable: true, hint: 'Digits only with country code, e.g. 919876543210. Leave empty to hide WhatsApp.' },
      { type: 'url', name: 'bookingUrl', label: 'Booking link', nullable: true, hint: 'Calendly or Cal.com link. Leave empty to hide.' },
      {
        type: 'group',
        name: 'address',
        label: 'Office address',
        nullable: true,
        hint: 'Leave empty until there is a public office.',
        fields: [
          { type: 'text', name: 'line', label: 'Address' },
          { type: 'url', name: 'mapUrl', label: 'Google Maps link' },
        ],
      },
      { type: 'text', name: 'businessHours', label: 'Business hours' },
      { type: 'text', name: 'replyTime', label: 'Reply time promise', hint: 'Shown after forms are sent, e.g. "within 1 working day".' },
      {
        type: 'list',
        name: 'social',
        label: 'Social profiles',
        itemLabel: 'Profile',
        fields: [
          { type: 'text', name: 'label', label: 'Name', hint: 'e.g. LinkedIn' },
          { type: 'url', name: 'url', label: 'Profile link', hint: 'The full profile address, not the site home page.' },
        ],
      },
    ],
  },
  {
    name: 'home',
    label: 'Homepage',
    description: 'Hero, reasons to choose you, process, capabilities and FAQ.',
    kind: 'single',
    editPermission: 'content.edit',
    titleOf: () => 'Homepage',
    fields: [
      {
        type: 'group',
        name: 'hero',
        label: 'Hero',
        fields: [
          { type: 'text', name: 'eyebrow', label: 'Small label above the headline' },
          { type: 'textarea', name: 'headline', label: 'Headline', rows: 2 },
          { type: 'textarea', name: 'intro', label: 'Supporting text', rows: 3 },
          { type: 'group', name: 'primaryCta', label: 'Main button', fields: [{ type: 'text', name: 'label', label: 'Text' }, { type: 'text', name: 'href', label: 'Link' }] },
          { type: 'group', name: 'secondaryCta', label: 'Second button', fields: [{ type: 'text', name: 'label', label: 'Text' }, { type: 'text', name: 'href', label: 'Link' }] },
        ],
      },
      { type: 'list', name: 'differentiators', label: 'Why choose us (3 or 4)', itemLabel: 'Reason', fields: [{ type: 'select', name: 'icon', label: 'Icon', options: icons }, ...titleBody()] },
      { type: 'list', name: 'process', label: 'Process steps (exactly 5)', itemLabel: 'Step', fields: [{ type: 'select', name: 'icon', label: 'Icon', options: icons }, ...titleBody('Step name')] },
      { type: 'list', name: 'capabilities', label: 'Capabilities', itemLabel: 'Group', fields: [{ type: 'text', name: 'group', label: 'Group name' }, { type: 'lines', name: 'items', label: 'Items', hint: 'One per line.' }] },
      faqs,
    ],
  },
  {
    name: 'about',
    label: 'About page',
    description: 'Story, mission, vision and values.',
    kind: 'single',
    editPermission: 'content.edit',
    titleOf: () => 'About page',
    fields: [
      { type: 'group', name: 'intro', label: 'Introduction', fields: [{ type: 'text', name: 'headline', label: 'Headline' }, { type: 'textarea', name: 'body', label: 'Text', rows: 3 }] },
      { type: 'lines', name: 'story', label: 'Our story', hint: 'One paragraph per line.' },
      { type: 'textarea', name: 'mission', label: 'Mission', rows: 2 },
      { type: 'textarea', name: 'vision', label: 'Vision', rows: 2 },
      { type: 'list', name: 'values', label: 'Values (3 to 5)', itemLabel: 'Value', fields: [{ type: 'select', name: 'icon', label: 'Icon', options: icons }, ...titleBody()] },
    ],
  },
  {
    name: 'services',
    label: 'Services',
    description: 'The service pages, in the order they appear.',
    kind: 'list',
    editPermission: 'content.edit',
    keyOf: (d) => String(d.slug ?? ''),
    titleOf: (d) => String(d.name ?? 'Untitled service'),
    fields: [
      { type: 'text', name: 'name', label: 'Service name' },
      { type: 'text', name: 'slug', label: 'Web address', hint: 'Lowercase words joined by hyphens. Changing it changes the page link.' },
      { type: 'text', name: 'navLabel', label: 'Short name for menus' },
      { type: 'select', name: 'icon', label: 'Icon', options: icons },
      { type: 'select', name: 'accent', label: 'Colour', options: options(['cobalt', 'violet', 'teal', 'amber']) },
      { type: 'text', name: 'outcome', label: 'One-line outcome', hint: 'Up to 110 characters.' },
      { type: 'textarea', name: 'summary', label: 'Summary', rows: 3 },
      { type: 'lines', name: 'examples', label: 'Three examples', hint: 'Exactly three, one per line.' },
      { type: 'group', name: 'hero', label: 'Page header', fields: [{ type: 'textarea', name: 'headline', label: 'Headline', rows: 2 }, { type: 'textarea', name: 'intro', label: 'Intro', rows: 3 }] },
      { type: 'list', name: 'problems', label: 'Problems we solve (3 or 4)', itemLabel: 'Problem', fields: titleBody() },
      { type: 'list', name: 'deliverables', label: 'Deliverables', itemLabel: 'Deliverable', fields: titleBody() },
      { type: 'lines', name: 'processNotes', label: 'Notes for each process step', hint: 'Exactly five lines, one per step.' },
      { type: 'list', name: 'technologies', label: 'Tools', itemLabel: 'Group', fields: [{ type: 'text', name: 'group', label: 'Group name' }, { type: 'lines', name: 'items', label: 'Items', hint: 'One per line.' }] },
      faqs,
      { type: 'textarea', name: 'disclaimer', label: 'Disclaimer (optional)', rows: 2 },
      seo,
    ],
  },
  {
    name: 'engagement',
    label: 'Engagement models',
    description: 'Ways to work together, shown on every service page.',
    kind: 'list',
    editPermission: 'content.edit',
    keyOf: (d) => slugify(String(d.name ?? '')),
    titleOf: (d) => String(d.name ?? 'Untitled model'),
    fields: [
      { type: 'text', name: 'name', label: 'Name' },
      { type: 'text', name: 'bestFor', label: 'Best for' },
      { type: 'textarea', name: 'description', label: 'Description', rows: 3 },
      { type: 'lines', name: 'points', label: 'Key points', hint: 'One per line.' },
    ],
  },
  {
    name: 'work',
    label: 'Projects',
    description: 'Case studies. Concept projects are always labelled as concepts.',
    kind: 'list',
    editPermission: 'content.edit',
    keyOf: (d) => String(d.slug ?? ''),
    titleOf: (d) => String(d.title ?? 'Untitled project'),
    fields: [
      { type: 'select', name: 'type', label: 'Project type', options: [{ value: 'concept', label: 'Concept project (self-initiated)' }, { value: 'client', label: 'Client project (needs written permission)' }] },
      { type: 'text', name: 'title', label: 'Title' },
      { type: 'text', name: 'slug', label: 'Web address', hint: 'Lowercase words joined by hyphens.' },
      { type: 'text', name: 'summary', label: 'One-line summary', hint: 'Up to 140 characters.' },
      { type: 'text', name: 'industry', label: 'Industry' },
      { type: 'lines', name: 'services', label: 'Services', hint: `One per line, from: ${serviceSlugs}` },
      { type: 'select', name: 'cover', label: 'Cover artwork', options: options(['clinic', 'saas', 'storefront']) },
      { type: 'boolean', name: 'featured', label: 'Show on the homepage' },
      { type: 'number', name: 'featuredOrder', label: 'Homepage order' },
      { type: 'text', name: 'duration', label: 'Timeline' },
      { type: 'textarea', name: 'challenge', label: 'The challenge', rows: 4 },
      { type: 'list', name: 'approach', label: 'Our approach', itemLabel: 'Decision', fields: titleBody() },
      { type: 'list', name: 'solution', label: 'The solution', itemLabel: 'Feature', fields: titleBody() },
      { type: 'lines', name: 'technologies', label: 'Technology', hint: 'One per line.' },
      { type: 'lines', name: 'goals', label: 'Goals', hint: 'Words only: numbers would read as real results.', showIf: { field: 'type', equals: 'concept' } },
      { type: 'text', name: 'clientName', label: 'Client name', nullable: true, showIf: { field: 'type', equals: 'client' } },
      {
        type: 'group',
        name: 'permission',
        label: 'Client permission',
        hint: 'Required before a client project can be published.',
        showIf: { field: 'type', equals: 'client' },
        fields: [
          { type: 'text', name: 'approvedBy', label: 'Approved by (name and role)' },
          { type: 'text', name: 'date', label: 'Date approved' },
          { type: 'boolean', name: 'showName', label: 'Client name may be shown' },
        ],
      },
      {
        type: 'list',
        name: 'outcomes',
        label: 'Results',
        itemLabel: 'Result',
        showIf: { field: 'type', equals: 'client' },
        fields: [
          { type: 'text', name: 'label', label: 'What was measured' },
          { type: 'text', name: 'value', label: 'Result', hint: 'e.g. +38%' },
          { type: 'text', name: 'source', label: 'Source', hint: 'Where the number comes from, e.g. client analytics, March 2027.' },
        ],
      },
      seo,
    ],
  },
  {
    name: 'team',
    label: 'Team',
    description: 'People shown on the About page. Each needs recorded consent.',
    kind: 'list',
    editPermission: 'team.edit',
    keyOf: (d) => String(d.slug ?? ''),
    titleOf: (d) => String(d.name ?? 'Unnamed person'),
    fields: [
      { type: 'text', name: 'name', label: 'Full name' },
      { type: 'text', name: 'slug', label: 'Short id', hint: 'Lowercase words joined by hyphens, e.g. priya-sharma.' },
      { type: 'text', name: 'designation', label: 'Role' },
      { type: 'select', name: 'department', label: 'Department', options: options(['Leadership', 'Engineering', 'Design', 'Marketing']) },
      { type: 'textarea', name: 'bio', label: 'Short bio', rows: 3, hint: 'Up to 280 characters.' },
      { type: 'lines', name: 'skills', label: 'Skills', hint: 'Up to 6, one per line.' },
      { type: 'image', name: 'photo', label: 'Photo', hint: 'Square photo works best. Leave empty to show initials.' },
      { type: 'text', name: 'photoAlt', label: 'Photo description', nullable: true, hint: 'For screen readers, e.g. "Priya smiling in the office".' },
      { type: 'list', name: 'links', label: 'Public links', itemLabel: 'Link', fields: [{ type: 'text', name: 'label', label: 'Name' }, { type: 'url', name: 'url', label: 'Link' }] },
      { type: 'number', name: 'order', label: 'Display order' },
      {
        type: 'group',
        name: 'consent',
        label: 'Consent to publish',
        hint: 'Required. Record when and how this person agreed to appear on the website.',
        fields: [
          { type: 'text', name: 'date', label: 'Date of consent' },
          { type: 'text', name: 'evidence', label: 'Evidence reference', hint: 'e.g. "Email of 12 Nov 2026, saved in HR drive". Never upload the document here.' },
        ],
      },
    ],
  },
  {
    name: 'testimonials',
    label: 'Testimonials',
    description: 'Genuine, consented client quotes only. Hidden on the site while empty.',
    kind: 'list',
    editPermission: 'content.edit',
    keyOf: (d) => slugify(`${d.name ?? ''}-${d.company ?? ''}`),
    titleOf: (d) => `${d.name ?? 'Unnamed'}, ${d.company ?? ''}`,
    fields: [
      { type: 'textarea', name: 'quote', label: 'Quote', rows: 4 },
      { type: 'text', name: 'name', label: 'Name' },
      { type: 'text', name: 'role', label: 'Role' },
      { type: 'text', name: 'company', label: 'Company' },
      { type: 'text', name: 'consentDate', label: 'Date of consent' },
      { type: 'url', name: 'sourceUrl', label: 'Public source', nullable: true, hint: 'Link to the Google review or LinkedIn recommendation, if any.' },
    ],
  },
];

export const getCollection = (name: string) => COLLECTIONS.find((c) => c.name === name);
