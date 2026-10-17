// Draft legal pages. They describe what this website actually does with data.
// They must be reviewed and approved by the client's legal adviser before launch (SOW MOD-K, CR-09).
export const legalReviewed = false;
export const lastUpdated = '17 October 2026';

export const legalPages = {
  privacy: {
    title: 'Privacy policy',
    description: 'What personal information this website collects, why, where it is stored, how long it is kept, and your rights.',
    intro: 'This policy explains what information we collect through this website, why we collect it, and how you can control it. We collect as little as we can.',
    sections: [
      {
        heading: 'Who we are',
        body: [
          'This website is operated by {company} ("we", "us"). For any privacy question or request, contact us using the details on our contact page. Our grievance contact will be named here before launch.',
        ],
      },
      {
        heading: 'What we collect',
        body: [
          'When you use our contact or quote form: your name, email address, and anything else you choose to give us, such as phone number, company, country, project details, budget range and a link. We also record which page you came from and any campaign tags in the link, so we know which channels work.',
          'For security: a one-way scrambled version (a hash) of your IP address, used only to stop abuse such as repeated automated submissions. We do not store your IP address itself.',
          'For website statistics: anonymous, aggregated visit data such as pages viewed, country and device type, collected without cookies.',
        ],
      },
      {
        heading: 'Why we use it',
        body: [
          'To reply to your enquiry and prepare a proposal, based on the consent you give when you submit the form.',
          'To send you occasional updates, only if you tick the separate optional box. You can unsubscribe at any time.',
          'To protect the website from spam and abuse, and to understand how the site is used so we can improve it.',
        ],
      },
      {
        heading: 'Who processes it for us',
        body: [
          'Cloudflare: hosts the website, stores form submissions, provides spam protection (Turnstile) and cookieless statistics.',
          'Resend: delivers the email notification to our team and the confirmation email to you.',
          'Our business email provider: receives the notification email in our inbox.',
          'We do not sell your information or share it with advertisers.',
        ],
      },
      {
        heading: 'How long we keep it',
        body: [
          'Enquiries are kept for 24 months, after which the personal details are erased automatically. The hashed IP records used for abuse prevention are deleted after 24 hours.',
        ],
      },
      {
        heading: 'Your rights',
        body: [
          'You can ask us to show you the information we hold about you, correct it, or delete it, and you can withdraw your consent at any time. Contact us and we will respond within 30 days. If you are not satisfied with our response, you may complain to the relevant data protection authority.',
        ],
      },
      {
        heading: 'Security',
        body: [
          'The site uses HTTPS encryption. Access to enquiries is limited to authorised team members who sign in with two-step verification, and every access to the admin is recorded.',
        ],
      },
      {
        heading: 'Changes to this policy',
        body: ['If we change this policy, we will update the date at the top of this page.'],
      },
    ],
  },
  terms: {
    title: 'Terms of use',
    description: 'The terms that apply when you use this website.',
    intro: 'These terms apply to your use of this website. They do not cover project work, which is always governed by a separate written agreement.',
    sections: [
      { heading: 'Using this website', body: ['You may browse and share our pages for personal and business purposes. Please do not misuse the site, attempt to break its security, or send automated or abusive submissions.'] },
      { heading: 'Information on this site', body: ['We work to keep information accurate and up to date, but it is general information, not a quotation or professional advice. Project scope, prices and timelines are agreed only in a written proposal.'] },
      { heading: 'Concept projects', body: ['Projects marked "Concept project" are self-initiated work created to show our approach. They are not client work and do not report real users or results.'] },
      { heading: 'Intellectual property', body: ['The content, design and code of this website belong to {company} unless stated otherwise. Do not copy them for commercial use without permission.'] },
      { heading: 'Links to other websites', body: ['We may link to other websites. We are not responsible for their content or privacy practices.'] },
      { heading: 'Liability', body: ['To the extent permitted by law, we are not liable for losses arising from use of this website. Nothing in these terms limits liability that cannot legally be limited.'] },
      { heading: 'Governing law', body: ['These terms are governed by the laws of India. The courts named here before launch will have jurisdiction.'] },
    ],
  },
  cookies: {
    title: 'Cookie notice',
    description: 'Which cookies and similar technologies this website uses.',
    intro: 'We keep tracking to a minimum. This website does not use advertising or cross-site tracking cookies.',
    sections: [
      { heading: 'Statistics without cookies', body: ['Our website statistics are collected by Cloudflare Web Analytics, which does not use cookies or identify individual visitors.'] },
      { heading: 'Spam protection', body: ['On the contact and quote pages, Cloudflare Turnstile checks that a real person is using the form. It may process technical browser signals for this purpose only.'] },
      { heading: 'Saving your form progress', body: ['The quote form keeps your unsent answers in your browser’s session storage, so a page refresh does not lose them. This stays on your device and is cleared when you send the form or close the tab.'] },
      { heading: 'Admin sign-in', body: ['Team members who sign in to the admin area receive a sign-in cookie from Cloudflare Access. Website visitors never receive it.'] },
      { heading: 'Changes', body: ['If we add any non-essential cookies in future, we will ask for your consent first and update this notice.'] },
    ],
  },
};

export type LegalSlug = keyof typeof legalPages;
