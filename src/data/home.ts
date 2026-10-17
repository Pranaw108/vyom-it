// Seed content for the homepage. Draft copy for client approval.
export const home = {
  hero: {
    eyebrow: 'Web · Mobile · Design · Growth',
    headline: 'We design and build the digital products your customers actually use.',
    intro:
      'Vyom IT is a design and engineering team for founders and growing businesses. Websites, mobile apps, product design and search growth, planned properly and built to last.',
    primaryCta: { label: 'Get a quote', href: '/quote' },
    secondaryCta: { label: 'See our work', href: '/work' },
  },
  differentiators: [
    {
      icon: 'users',
      title: 'One team, design to launch',
      body: 'Designers, developers and marketers work as one team, so nothing gets lost between hand-offs.',
    },
    {
      icon: 'clock',
      title: 'Clear proposals, fast',
      body: 'A fixed-scope proposal within 3 working days of our first call, with every deliverable written down.',
    },
    {
      icon: 'lock',
      title: 'You own everything',
      body: 'Code, designs, domains and accounts are yours from day one. No lock-in, no hostage hosting.',
    },
    {
      icon: 'shield',
      title: 'Production standard by default',
      body: 'Security, accessibility and speed are part of the work we quote, not optional extras.',
    },
  ],
  process: [
    { icon: 'compass', title: 'Discover', body: 'We learn your business, users and goals, then agree scope, budget and success measures.' },
    { icon: 'pen', title: 'Design', body: 'Wireframes, then polished designs and a clickable prototype you approve before we build.' },
    { icon: 'code', title: 'Build', body: 'Weekly progress you can click through on a private preview link.' },
    { icon: 'checks', title: 'Test', body: 'Real devices, accessibility, speed and security checks before anything goes live.' },
    { icon: 'flag', title: 'Launch and support', body: 'We launch, monitor and fix, then help you grow with updates, SEO and campaigns.' },
  ],
  capabilities: [
    { group: 'Web', items: ['Astro', 'Next.js', 'React', 'TypeScript', 'Node.js'] },
    { group: 'Mobile', items: ['React Native', 'Flutter', 'Swift', 'Kotlin'] },
    { group: 'Design', items: ['Figma', 'Design systems', 'Prototyping', 'Usability testing'] },
    { group: 'Cloud and data', items: ['Cloudflare', 'AWS', 'PostgreSQL', 'Firebase'] },
    { group: 'Growth', items: ['Technical SEO', 'Google Ads', 'Meta Ads', 'GA4'] },
  ],
  faqs: [
    {
      question: 'How much does a project cost?',
      answer:
        'It depends on what you need: the number of pages or screens, features, integrations and content. After a short call we send a fixed-scope proposal with a clear price, so there are no surprises.',
    },
    {
      question: 'How long does a typical project take?',
      answer:
        'A marketing website usually takes 4 to 8 weeks. An app or web application MVP usually takes 8 to 16 weeks. Your proposal includes a week-by-week plan.',
    },
    {
      question: 'Do you work with startups and small businesses?',
      answer:
        'Yes. Many of our projects start with a founder and an idea. We help you decide what to build first so your budget goes into what matters most.',
    },
    {
      question: 'Who owns the code and designs?',
      answer:
        'You do. Code lives in your repository, designs in your files, and hosting, domains and app store listings in your accounts.',
    },
    {
      question: 'Can you work with our existing team or codebase?',
      answer:
        'Yes. We start with a short review of your code and setup, then agree how we fit in, whether that means taking over a module or working alongside your developers.',
    },
    {
      question: 'What happens after launch?',
      answer:
        'Every project includes a 30-day warranty for fixes. After that you can choose a monthly support plan for updates, monitoring, SEO and new features.',
    },
  ],
};
