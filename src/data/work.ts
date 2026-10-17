// Seed content: concept projects that show our approach. Labelled "Concept" everywhere they appear.
// They describe design decisions only; they never claim research, users or results that did not happen.
export const caseStudies = [
  {
    type: 'concept',
    slug: 'carepoint-clinic-booking',
    title: 'CarePoint clinic booking app',
    summary: 'A patient app for booking, rescheduling and paying for clinic visits in under a minute.',
    industry: 'Healthcare',
    services: ['mobile-app-development', 'ui-ux-design'],
    cover: 'clinic',
    featured: true,
    featuredOrder: 1,
    duration: 'Concept · designed as a 12-week MVP plan',
    challenge:
      'Small clinics still take most bookings by phone. Patients wait on hold, receptionists juggle calls and walk-ins at the same time, and missed appointments leave gaps in the doctor’s day.',
    approach: [
      { title: 'Three jobs, nothing else', body: 'We cut the first version to the three things patients actually need: book, reschedule and pay. Everything else waits for real usage data.' },
      { title: 'Designed for every age', body: 'Large tap targets, plain language and no account needed to book, so a first-time or older patient can finish without help.' },
      { title: 'Reception stays in control', body: 'A simple web view lets reception see the day, block slots and add walk-ins, so the app fits how the clinic already works.' },
    ],
    solution: [
      { title: 'Three-tap booking', body: 'Pick a doctor, pick a time, confirm. Available slots update live so double bookings cannot happen.' },
      { title: 'Reminders that reduce no-shows', body: 'Reminders by notification and SMS, with a one-tap reschedule link instead of a phone call.' },
      { title: 'Pay before or after the visit', body: 'UPI and card payments with receipts in the app, and cash still allowed at the desk.' },
    ],
    technologies: ['React Native', 'Node.js', 'PostgreSQL', 'Razorpay', 'Firebase Cloud Messaging'],
    goals: ['Fewer booking calls for reception', 'Fewer missed appointments', 'Faster booking for patients'],
    seo: {
      title: 'CarePoint clinic booking app (concept)',
      description: 'A concept mobile app for clinics: three-tap booking, reminders that reduce no-shows and in-app payments.',
    },
  },
  {
    type: 'concept',
    slug: 'ledgerly-finance-dashboard',
    title: 'Ledgerly finance dashboard',
    summary: 'A redesign of a small-business accounting dashboard built around cash-flow clarity.',
    industry: 'Fintech and SaaS',
    services: ['ui-ux-design', 'website-development'],
    cover: 'saas',
    featured: true,
    featuredOrder: 2,
    duration: 'Concept · designed as a 6-week redesign',
    challenge:
      'Business owners open dashboards full of charts and still cannot answer the one question they care about: will there be enough cash next month?',
    approach: [
      { title: 'Start from the owner’s questions', body: 'Every screen answers a question an owner actually asks, such as "who owes me money?" or "what do I pay this week?".' },
      { title: 'One number first, detail on demand', body: 'The dashboard leads with cash runway. Charts and tables open only when the owner wants to dig deeper.' },
      { title: 'A design system, not one-off screens', body: 'Reusable components and tokens so new features look and behave the same as the rest of the product.' },
    ],
    solution: [
      { title: 'Cash runway card', body: 'How many weeks the business can run on current cash, with the bills and invoices that change it.' },
      { title: 'Payments timeline', body: 'Money in and money out for the next 30 days on one simple timeline.' },
      { title: 'Alerts in plain language', body: '"Two invoices are overdue" instead of red numbers in a table, with a button to send a reminder.' },
    ],
    technologies: ['Figma', 'React', 'TypeScript', 'Design tokens', 'Storybook'],
    goals: ['Owners answer cash questions in seconds', 'Fewer support requests about reports', 'More owners returning every week'],
    seo: {
      title: 'Ledgerly finance dashboard redesign (concept)',
      description: 'A concept UX redesign of a small-business finance dashboard, built around cash runway and plain-language alerts.',
    },
  },
  {
    type: 'concept',
    slug: 'kaapi-house-storefront',
    title: 'Kaapi House online storefront',
    summary: 'A website and local SEO plan for an independent coffee roaster selling online and in store.',
    industry: 'Retail and food',
    services: ['website-development', 'digital-marketing-seo'],
    cover: 'storefront',
    featured: true,
    featuredOrder: 3,
    duration: 'Concept · designed as a 5-week build',
    challenge:
      'An independent roaster sells at its café and through Instagram messages. Orders get lost in chats, there is no way to subscribe, and the shop does not appear when people nearby search for fresh coffee beans.',
    approach: [
      { title: 'Sell the way regulars buy', body: 'Subscriptions and gift boxes first, because repeat customers drive most of a roaster’s revenue.' },
      { title: 'Be found locally', body: 'A complete Google Business Profile, location pages and reviews strategy so the café appears in nearby searches.' },
      { title: 'Content that sells coffee', body: 'Short brewing guides for each bean, linked to the product, answering what buyers search for.' },
    ],
    solution: [
      { title: 'Fast storefront', body: 'A lightweight online shop with subscriptions, gift boxes and UPI checkout, fast on mobile data.' },
      { title: 'Orders out of the inbox', body: 'Every order lands in one dashboard with stock, delivery status and customer details.' },
      { title: 'Local search setup', body: 'Business profile, structured data and a monthly plan for reviews and posts.' },
    ],
    technologies: ['Astro', 'Razorpay', 'Cloudflare', 'Google Business Profile', 'Search Console'],
    goals: ['Orders move out of social media messages', 'The shop appears in local searches', 'More customers on repeat subscriptions'],
    seo: {
      title: 'Kaapi House coffee storefront (concept)',
      description: 'A concept website and local SEO plan for an independent coffee roaster: subscriptions, UPI checkout and local search.',
    },
  },
];

// Only genuine, consented testimonials go here (FR-019, FR-020).
export const testimonials = [];
