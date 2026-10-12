# Savora Web Project Instructions

## Project owner and scope
- The user is the project architect and final decision-maker. Follow the specific task they approve; do not infer approval for additional work.
- Inspect the relevant existing files before editing. Make the smallest change that completes the approved task and leave unrelated files untouched.
- Ask the user before making a major architectural or structural decision.
- Do not change architecture, page structure, visual design, dependencies, or features unless the user explicitly approves that change.
- Do not add frameworks, libraries, dependencies, or external services without approval. Do not introduce Tailwind CSS unless explicitly approved.
- Preserve the existing Savora design system, page structure, external `style.css` architecture, responsive behavior, and working functionality. Avoid generic redesigns or cookie-cutter patterns.

## Current codebase
- This is a plain multi-page frontend made from HTML pages, one shared `style.css`, and a shared `script.js`. No package manifest or build configuration is present in the project root.
- Pages currently present: `index.html`, `about.html`, `menu.html`, `contact.html`, `order.html`, `login.html`, `signup.html`, `Password-reset.html`, and `dashboard.html`.
- The HTML pages link to the external `style.css`; most interactive pages also load `script.js`. Keep shared styling in `style.css` and shared browser behavior in `script.js` unless the user approves a structural change.
- The style sheet defines Savora colors as CSS variables (`--deep-navy`, `--burnt-orange`, `--warm-ivory`, and `--soft-bronze`) and includes responsive breakpoints and reduced-motion handling. Preserve these conventions when making approved styling changes.
- `script.js` currently handles mobile navigation, delivery/pickup address state, scroll reveal behavior, reduced-motion behavior, and the About page counters.
- Login, sign-up, and password-reset pages currently contain UI forms. Their current HTML actions do not establish Firebase authentication. `contact.html` has a reservation form with a `submit_reservation.php` action; do not treat that as proof that Formspree or another backend is configured.

## Backend plan and status
- Planned backend services are Firebase Authentication, Firestore, Firestore Security Rules, and Formspree for approved order, contact, and reservation submissions. This plan is documentation only; do not implement backend features unless the user explicitly approves the specific implementation task.
- Firebase has not been configured, backend integration has not started, and Formspree has not been configured.
- The password-reset page exists as UI but is not connected to Firebase. Dashboard HTML exists, and dashboard styling is incomplete. Main restaurant frontend pages, login UI, and sign-up UI are substantially built and styled.
- Never store passwords manually. Never expose privileged Firebase or server credentials in client-side code. Firestore rules must enforce authenticated, owner-scoped access when that work is explicitly approved.
- The previous Dashboard `order now.html` link issue was corrected by the user. Treat it as fixed; do not reintroduce it or report it as an active issue.

## Implementation workflow
1. Inspect the relevant local files before changing anything.
2. Work only on the approved task; do not rewrite unrelated code or files.
3. Preserve existing working behavior and project conventions.
4. Make changes intentional and consistent with the current codebase.
5. Explain important changes when appropriate. If a requested change depends on an unapproved major architectural decision, stop and ask the user first.
