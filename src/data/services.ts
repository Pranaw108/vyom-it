// Seed content for the four service pages. Draft copy for client approval.
export const services = [
  {
    slug: 'website-development',
    name: 'Website development',
    navLabel: 'Websites',
    icon: 'code',
    accent: 'cobalt',
    outcome: 'Fast, secure websites and web apps that turn visitors into enquiries.',
    summary:
      'Marketing websites, web applications and customer portals built on modern, low-maintenance technology, with speed, accessibility and security included.',
    examples: ['Company and marketing websites', 'Web apps and customer portals', 'Admin panels and dashboards'],
    hero: {
      headline: 'Websites that load fast, rank well and bring in business.',
      intro:
        'We plan, design and build websites and web applications that your customers enjoy using and your team can update without calling a developer.',
    },
    problems: [
      { title: 'Your site looks out of date', body: 'Visitors judge credibility in seconds. A dated design quietly sends them to a competitor.' },
      { title: 'It is slow on phones', body: 'Most visitors arrive on mobile. Slow pages lose them before your message even loads.' },
      { title: 'You cannot update it yourself', body: 'Every small text change becomes a request to a developer and a week of waiting.' },
      { title: 'Enquiries go missing', body: 'Forms that fail silently or land in spam cost you leads you never knew existed.' },
    ],
    deliverables: [
      { title: 'Discovery and sitemap', body: 'Goals, audience, page plan and content checklist agreed before design starts.' },
      { title: 'UX and visual design', body: 'Wireframes, polished designs and a clickable prototype for mobile and desktop.' },
      { title: 'Development', body: 'Clean, tested code with a content admin your team can use.' },
      { title: 'Forms and integrations', body: 'Enquiry forms with spam protection, email alerts, CRM and analytics connections.' },
      { title: 'SEO and speed baseline', body: 'Metadata, sitemaps, structured data and Core Web Vitals checks before launch.' },
      { title: 'Launch and handover', body: 'Hosting in your account, documentation and a recorded training session.' },
    ],
    processNotes: [
      'Sitemap, content plan and success measures',
      'Wireframes, then visual design and prototype',
      'Weekly builds on a private preview link',
      'Browser, device, accessibility and speed testing',
      'Launch, 30-day warranty, optional support plan',
    ],
    technologies: [
      { group: 'Front end', items: ['Astro', 'Next.js', 'React', 'TypeScript', 'Tailwind CSS'] },
      { group: 'Back end', items: ['Node.js', 'Cloudflare Workers', 'PostgreSQL'] },
      { group: 'Content', items: ['Custom admin panels', 'Headless CMS', 'WordPress (on request)'] },
      { group: 'Hosting', items: ['Cloudflare', 'Vercel', 'AWS'] },
    ],
    faqs: [
      {
        question: 'How much does a website cost?',
        answer:
          'It depends on the number of pages, features, integrations and how much content you already have. After a short call we send a fixed-scope proposal with one clear price.',
      },
      {
        question: 'How long does it take to build?',
        answer:
          'A marketing website usually takes 4 to 8 weeks from kickoff. Web applications take longer and are planned in phases. Your proposal includes a week-by-week plan.',
      },
      {
        question: 'Will I be able to edit the website myself?',
        answer:
          'Yes. Every site comes with an admin panel or CMS and a short training session, so your team can update text, images, case studies and blog posts.',
      },
      {
        question: 'Who hosts the website?',
        answer:
          'You do. We set up hosting in your own account, usually on a fast global platform, and hand over full access at launch.',
      },
    ],
    seo: {
      title: 'Website Development Services',
      description:
        'Fast, secure, easy-to-update websites and web apps. Vyom IT designs, builds and launches sites that turn visitors into enquiries.',
    },
  },
  {
    slug: 'mobile-app-development',
    name: 'Mobile app development',
    navLabel: 'Mobile apps',
    icon: 'smartphone',
    accent: 'violet',
    outcome: 'iOS and Android apps, from first prototype to the App Store and Play Store.',
    summary:
      'Cross-platform and native mobile apps for startups and businesses, including the backend, admin panel and store launch.',
    examples: ['MVPs for startups', 'Customer and booking apps', 'Field and operations apps'],
    hero: {
      headline: 'Mobile apps people keep on their home screen.',
      intro:
        'We take your app from idea to the App Store and Google Play: product planning, design, development, backend and launch, with one team accountable for all of it.',
    },
    problems: [
      { title: 'You have an idea but no tech team', body: 'You need someone to turn it into a plan, a budget and a working first version.' },
      { title: 'Two native apps feel out of reach', body: 'Building iOS and Android separately can double cost. Often one cross-platform app is the smarter start.' },
      { title: 'Your current app gets poor reviews', body: 'Crashes, slow screens and confusing flows push users to uninstall.' },
      { title: 'Store approval feels like a gamble', body: 'Rejections and delays are common when guidelines are not built in from the start.' },
    ],
    deliverables: [
      { title: 'Product discovery', body: 'Feature list, priorities and an MVP scope that fits your budget.' },
      { title: 'UX flows and prototype', body: 'Clickable prototype to test with real users before development.' },
      { title: 'App development', body: 'Cross-platform (React Native or Flutter) or native (Swift, Kotlin), chosen for your needs.' },
      { title: 'Backend and admin panel', body: 'APIs, database, notifications and an admin panel to manage your app.' },
      { title: 'Real-device testing', body: 'Testing across popular phones, screen sizes and OS versions.' },
      { title: 'Store launch', body: 'Listings, screenshots, submission and release under your developer accounts.' },
    ],
    processNotes: [
      'MVP scope, platform choice and release plan',
      'User flows, prototype and user testing',
      'Two-week sprints with test builds on your phone',
      'Device lab, performance and crash testing',
      'Store submission, monitoring and updates',
    ],
    technologies: [
      { group: 'Cross-platform', items: ['React Native', 'Flutter', 'Expo'] },
      { group: 'Native', items: ['Swift', 'SwiftUI', 'Kotlin', 'Jetpack Compose'] },
      { group: 'Backend', items: ['Node.js', 'Firebase', 'PostgreSQL'] },
      { group: 'Release', items: ['TestFlight', 'Google Play Console', 'Crash reporting'] },
    ],
    faqs: [
      {
        question: 'Should my app be native or cross-platform?',
        answer:
          'Most business apps work very well cross-platform, which means one codebase for iOS and Android and a lower cost. Native makes sense for heavy graphics, advanced device features or very large apps. We recommend one after discovery.',
      },
      {
        question: 'How long does it take to launch an MVP?',
        answer:
          'Usually 8 to 16 weeks, depending on features and the backend. We plan the smallest version that proves your idea, then improve it with real user feedback.',
      },
      {
        question: 'Will my app be approved by Apple and Google?',
        answer:
          'No one can guarantee approval, but we design and build to the current store guidelines and handle the submission, which avoids the most common reasons for rejection.',
      },
      {
        question: 'Who owns the app and store listings?',
        answer:
          'You do. The app is published under your own Apple and Google developer accounts, and the code lives in your repository.',
      },
    ],
    seo: {
      title: 'Mobile App Development: iOS and Android',
      description:
        'iOS and Android app development from MVP to store launch. Cross-platform or native, with backend, admin panel and real-device testing.',
    },
  },
  {
    slug: 'ui-ux-design',
    name: 'UI/UX design',
    navLabel: 'UI/UX design',
    icon: 'pen',
    accent: 'teal',
    outcome: 'Research-led interfaces that are easy to use and ready to build.',
    summary:
      'Product, app and website design grounded in research: flows, wireframes, prototypes and design systems your developers can build exactly.',
    examples: ['Product and app design', 'Website redesigns', 'Design systems'],
    hero: {
      headline: 'Design that makes the next step obvious.',
      intro:
        'We design products and websites around what your users are trying to do, test the ideas early, and hand developers files they can build without guessing.',
    },
    problems: [
      { title: 'Users drop off halfway', body: 'Sign-ups, checkouts or bookings start well and then stall at the same screen.' },
      { title: 'Every screen looks different', body: 'The product grew feature by feature and no longer feels like one product.' },
      { title: 'Developers are guessing', body: 'Missing states, unclear spacing and no components lead to rework and bugs.' },
      { title: 'Decisions come down to opinion', body: 'Without user evidence, the loudest voice in the room decides.' },
    ],
    deliverables: [
      { title: 'Research', body: 'Stakeholder interviews, user interviews and a review of your current product.' },
      { title: 'Flows and structure', body: 'User journeys, information architecture and navigation.' },
      { title: 'Wireframes', body: 'Fast, low-detail layouts to agree structure before visual design.' },
      { title: 'High-fidelity UI', body: 'Polished screens for mobile, tablet and desktop, in light and dark where needed.' },
      { title: 'Interactive prototype', body: 'A clickable prototype for stakeholder review and usability testing.' },
      { title: 'Design system and handoff', body: 'Reusable components, tokens and annotated specs for developers.' },
    ],
    processNotes: [
      'Interviews, analytics review and goals',
      'Flows, wireframes, then visual design',
      'Prototype and component library',
      'Usability tests and accessibility checks',
      'Developer handoff and design QA',
    ],
    technologies: [
      { group: 'Design', items: ['Figma', 'FigJam', 'Design tokens'] },
      { group: 'Research', items: ['User interviews', 'Usability testing', 'Analytics review'] },
      { group: 'Handoff', items: ['Figma Dev Mode', 'Storybook', 'Annotated specs'] },
    ],
    faqs: [
      {
        question: 'Do you redesign existing products?',
        answer:
          'Yes. We start with a review of what works today, then improve the parts that matter most rather than changing everything at once.',
      },
      {
        question: 'What will I receive at the end?',
        answer:
          'Figma files with every screen and state, a clickable prototype, a component library and annotated specs. You own all of it.',
      },
      {
        question: 'Can you work with our developers?',
        answer:
          'Yes. We join handoff meetings, answer questions during the build and review the result against the design before release.',
      },
      {
        question: 'How many revision rounds are included?',
        answer:
          'Proposals usually include two revision rounds per design stage. Extra rounds are always agreed before we start them.',
      },
    ],
    seo: {
      title: 'UI/UX Design Services',
      description:
        'Research-led UI/UX design for apps, products and websites: user flows, wireframes, prototypes and design systems ready for development.',
    },
  },
  {
    slug: 'digital-marketing-seo',
    name: 'Digital marketing and SEO',
    navLabel: 'Marketing & SEO',
    icon: 'trending',
    accent: 'amber',
    outcome: 'Search visibility, campaigns and reporting focused on qualified leads.',
    summary:
      'Technical SEO, content, local search and paid campaigns, with honest monthly reporting on what is bringing you customers.',
    examples: ['Technical SEO audits', 'Google and Meta ad campaigns', 'Content and local SEO'],
    hero: {
      headline: 'Get found by the people already looking for you.',
      intro:
        'We fix what stops search engines understanding your site, create content your buyers search for, and run campaigns we measure by enquiries, not clicks.',
    },
    problems: [
      { title: 'You are invisible on Google', body: 'Competitors show up for the services you sell, and you do not.' },
      { title: 'Ad spend with nothing to show', body: 'Money goes out every month but nobody can say which campaigns bring customers.' },
      { title: 'Traffic but no enquiries', body: 'People visit, read and leave without getting in touch.' },
      { title: 'No idea what is working', body: 'Analytics are not set up, or the reports are full of numbers that do not matter.' },
    ],
    deliverables: [
      { title: 'Technical SEO audit and fixes', body: 'Speed, indexing, structured data and site structure checked and fixed.' },
      { title: 'Keyword and content plan', body: 'The questions your buyers search for, turned into a publishing plan.' },
      { title: 'On-page optimisation', body: 'Titles, descriptions, headings and internal links tuned page by page.' },
      { title: 'Local SEO', body: 'Google Business Profile setup and local search improvements.' },
      { title: 'Paid campaigns', body: 'Google and Meta campaigns set up, tracked and optimised for leads.' },
      { title: 'Monthly reporting', body: 'A short report on leads, rankings and spend, with next month’s plan.' },
    ],
    processNotes: [
      'Audit, competitor review and goals',
      'Content plan and landing page improvements',
      'Fixes, content and campaign launch',
      'Conversion tracking checks',
      'Monthly reporting and optimisation',
    ],
    technologies: [
      { group: 'Measurement', items: ['Google Search Console', 'GA4', 'Looker Studio'] },
      { group: 'Search', items: ['Technical SEO', 'Structured data', 'Local SEO'] },
      { group: 'Paid', items: ['Google Ads', 'Meta Ads Manager'] },
    ],
    faqs: [
      {
        question: 'How long does SEO take to work?',
        answer:
          'Technical fixes can help within weeks, but meaningful growth usually takes several months of consistent work. We report progress every month so you can see the trend.',
      },
      {
        question: 'Do you guarantee first-page rankings?',
        answer:
          'No. Nobody controls Google’s results, and anyone who guarantees rankings is guessing. We commit to the work, transparent reporting and honest advice.',
      },
      {
        question: 'Do I need ads, SEO or both?',
        answer:
          'Ads bring traffic quickly while you pay. SEO builds traffic that lasts but takes longer. Many businesses start with both and shift budget as SEO grows.',
      },
      {
        question: 'Can you review my current website first?',
        answer:
          'Yes. Request a free website audit and we will send a short list of the most important improvements, with no obligation.',
      },
    ],
    disclaimer:
      'Search rankings depend on competition, content and time. No one can guarantee a position on Google, and we never promise one.',
    seo: {
      title: 'Digital Marketing and SEO Services',
      description:
        'Technical SEO, content, local search and Google and Meta campaigns measured by qualified leads, with honest monthly reporting.',
    },
  },
];
