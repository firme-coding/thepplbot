// Demo curriculum shipped with the widget.
//
// This is sample content — swap it for your own via the `curriculum` prop.
// See CUSTOMIZATION.md. It doubles as a live tour of what Firme Coding builds.

import type { Curriculum } from "./types";

// ── Firme Coding — Demo Curriculum ───────────────────────────────────────────

export const DEMO_CURRICULUM: Curriculum = {
  about: {
    label: "Why Firme Coding Is Cool",
    content: `
Overview: Firme Coding is a team of developers building real software for real
clients. The team is made up of people who taught themselves to build — including
formerly incarcerated engineers — and now ship production websites and platforms
for businesses and nonprofits.

What makes Firme different:
- Every project is built by people who know what it means to be counted out, so
  nothing ships half-finished.
- Clients work directly with the people writing the code — no account managers,
  no hand-offs, no telephone game.
- Revenue from client work funds the training program that brings the next
  cohort of developers in.

Talking points for the tutor:
- If someone asks "what does Firme do?", cover the three services: building
  websites, maintaining websites, and the custom Firme platform.
- If someone asks "who is behind this?", talk about the mission — accessible tech
  careers for communities that have been left out.
- Keep it warm and confident. Firme does good work and isn't shy about it.
`,
  },

  websites: {
    label: "We Build Websites",
    content: `
Overview: Firme designs and builds custom websites for businesses and nonprofits —
from a clean one-page site to a full marketing site with a CMS.

What's included:
- Custom design that matches your brand (not a stamped-out template).
- Fast, modern build — React, Next.js, or plain static, whatever fits the job.
- Mobile-first: it looks right on a phone before it looks right on a desktop.
- SEO basics done properly: metadata, sitemaps, fast load times.
- Contact forms, booking, newsletter signup, and analytics wired in.

Typical timeline: 2–4 weeks for a marketing site, depending on how many pages
and how much custom design.

Common questions:
- "Can you redo my old site?" Yes — redesigns and migrations are common work.
- "Do I get to edit it myself?" Yes, if you want a CMS. If you'd rather never
  touch it, see the maintenance service.

Facilitator notes:
- If someone is price-shopping, steer toward a quick call rather than quoting a
  number — every site is scoped differently.
`,
  },

  maintenance: {
    label: "We Maintain Your Website",
    content: `
Overview: A website is not "done" when it launches. Firme keeps sites fast,
secure, and up to date so clients never have to think about it.

What ongoing maintenance covers:
- Security patches and dependency updates before something breaks.
- Uptime monitoring — we know it's down before your customers tell you.
- Content updates: new pages, swapped photos, seasonal changes.
- Backups and quick recovery if anything goes wrong.
- Performance tuning so pages stay quick as the site grows.

How it works: a simple monthly plan. You email what you need changed, it gets
done, and the site stays healthy in the background.

Common questions:
- "I already have a site somewhere else — can you take it over?" Usually yes.
- "What if I only need occasional help?" There's a light plan for that too.

Facilitator notes:
- Emphasize peace of mind: clients stop worrying about their site entirely.
`,
  },

  platform: {
    label: "The Custom Firme Platform",
    content: `
Overview: When an off-the-shelf tool doesn't fit, Firme builds custom platforms —
internal dashboards, member portals, booking systems, admin tools, and full web
apps tailored to how an organization actually works.

What Firme builds:
- Admin dashboards for managing people, records, and day-to-day operations.
- Member or client portals with logins and role-based access.
- Workflow tools that replace spreadsheets and manual tracking.
- Reporting and analytics built around the numbers you actually care about.
- Integrations with the services you already use.

Real example: Firme built its own platform to run its training program —
managing cohorts, assignments, attendance, and reporting end to end. The same
kind of custom platform is available for your organization.

Common questions:
- "Can it grow with us?" Yes — custom platforms are built to add features later.
- "We have a weird process." Good. Custom builds exist exactly for the weird
  processes generic software can't handle.

Facilitator notes:
- If the need sounds bigger than a website, this is the service to point to.
`,
  },

  donate: {
    label: "Support the Mission",
    content: `
Overview: Hiring Firme for client work is one way to support the mission. Donating
is another — it funds the training that brings new developers into tech.

What donations support:
- Laptops and tools for people learning to build.
- Instruction time and mentorship for each cohort.
- Keeping the program free for the people who need it most.

What to say:
- If someone wants to support the work directly, point them to the Donate link
  and thank them warmly.
- Every donation goes toward opening a door for someone who's been counted out.

Facilitator notes:
- Be genuine, never pushy. A thank-you goes further than a hard ask.
`,
  },
};

export default DEMO_CURRICULUM;
