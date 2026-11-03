# Product specification: UniAI (University AI)

**Status:** Working draft, version 0.1  
**Long-term audience:** Learners from primary school through university  
**First pilot audience:** University students, initially at NMU  
**Initial use case:** Turning a student's course documents into a personal study pack and plan

## 1. Product intent

UniAI (short for University AI) is an independent, AI-assisted learning companion for learners from primary school through university. Students add their learning materials; UniAI helps turn them into understandable explanations, short video lessons, quizzes, revision resources, and a personal study plan with reminders. The product is designed for multiple schools and universities, with a simple experience that can adapt to a learner's stage and reading level. The first pilot should stay focused on university students, then expand to younger learners after child-safety, privacy, and learning-quality requirements are ready.

It complements official university services and course platforms. It does not represent NMU, replace lecturers, give official academic decisions, or guarantee marks.

## 2. Problem to validate

Students may have course material spread across documents and platforms, and may need help understanding it, checking their knowledge, and planning revision. The pilot must validate which of these problems is most frequent and whether students return to use the product.

## 3. First user and job

**First pilot user:** A university student preparing for a test or examination in a selected module.

**Long-term users:** Primary, secondary, and tertiary learners, with age-appropriate onboarding, explanations, navigation, and support.

**Job to be done:** “When I add material from my class or course, help me understand it in a way that works for me, practise it, and make a plan I can follow.”

The initial pilot should cover a small number of willing university students and two or three modules, with permission to use all supplied content. This validates the core learning workflow before introducing younger learners and school accounts. These are proposed pilot boundaries, not evidence of market size.

### Experience by learner stage

- **Primary learners:** short instructions, concrete examples, limited choices per screen, read-aloud support, and age-appropriate safety boundaries.
- **Secondary learners:** guided study packs, revision planning, and increasing control over learning goals.
- **Tertiary learners:** deeper explanations, source inspection, independent planning, and advanced study controls.
- Let users choose a reading level or grade band where possible; avoid collecting an exact date of birth unless it is necessary and approved.
- Do not add open direct messaging, public profiles, or social discovery as part of the younger learner experience.

## 4. Core user journey

1. Student creates an account and chooses or creates a university, course, and module space.
   - On first visit, a short welcome screen explains UniAI and offers a clear “Add a module” action.
   - The learner can name a module and enter its module code; the module list supports add, edit, and delete.
2. Student adds permitted slides, notes, readings, or other course documents to a module.
3. Once the document is processed, UniAI asks the student to choose a study mode:
   - **Summary and practice:** summarize the uploaded material, then generate related questions and a checkpoint exam.
   - **Broaden my knowledge:** explain the uploaded material and search for related web information with visible, clickable references.
4. UniAI can also create revision notes and flashcards, and offer a short video lesson when requested.
5. Student studies, asks follow-up questions, and practises. Answers based on uploaded files or web research show which source supports them.
6. The learner takes a checkpoint exam after studying a topic. If they do not pass, UniAI identifies missed concepts, explains those parts, and offers a fresh exam. The review-and-retry loop continues until they pass; ordinary tutor questions are not blocked after a fixed prompt count.
7. Student adds study sessions and important dates to a personal timeline.
8. Optional reminders prompt the student about upcoming study sessions or deadlines.
9. UniAI suggests a next topic based on the student's activity and practice results.

## 5. MVP requirements

### P0 — required for the pilot

- Responsive web experience with a simple student home page.
- First-visit welcome screen that explains UniAI and leads directly to adding a learner-created module.
- Learners can add, edit, open, and delete their own modules using a module name and code.
- Learners must sign up and sign in for long-term saving and cross-visit access. Unsigned guest activity is temporary and cleared when the guest session ends.
- Sign-up choices: Google account, email with password, or SMS-verified phone as an alternative. A phone number is not required for learners who choose Google or email.
- Ask for a name to display and a username; keep usernames private by default and collect only the contact detail needed for the selected sign-up route.
- University, course, module, and topic organization that is not tied to one institution.
- Upload of permitted slides and documents, with file type and size limits.
- Text extraction and search over uploaded content.
- After processing, ask the learner to choose “Summary and practice” or “Broaden my knowledge”.
- In broader-knowledge mode, combine course material with related web research, keep the two source types distinct, and show clickable references. Prefer authoritative educational sources.
- Before sending content to an external AI provider, explain what will be sent and obtain an explicit learner action.
- AI explanations grounded in selected course material, with source references when available.
- A clear response when the source material does not support an answer.
- Generated study pack with revision notes, flashcards, practice questions, and answer explanations.
- Checkpoint exams for each study topic. When a learner does not pass, explain their missed concepts and generate a fresh attempt; continue the supported review-and-retry loop until the learner passes.
- Video lesson generation as a staged capability: begin with a script and narrated/slideshow format, then add richer video production after quality and cost are validated.
- Basic topic-level study history and a “review next” suggestion.
- Student-managed study timeline for sessions, test dates, and deadlines.
- Opt-in reminders for a student's own timeline items.
- Account data and uploaded material can be deleted by the student or pilot administrator.
- Basic admin controls to remove harmful, mistaken, or unpermitted content.

### P1 — after the core learning loop is proven

- More advanced planner with recurring availability, adaptive time allocation, and calendar integrations.
- Custom reminder channels and notification preferences.
- More document formats and richer source highlighting.
- Teacher/tutor authored lessons and reviewed question sets.
- Language and accessibility options informed by pilot users.

### Explicitly out of scope for the first release

- Direct access to NMU student records, LMS, timetable, or identity systems.
- Automated assignment writing, exam answering, or submission.
- Public social network, marketplace, or lecturer analytics.
- Native mobile applications.
- Large-scale AI video generation.
- Claims that UniAI is endorsed by NMU without a formal agreement.

## 6. Product quality requirements

- **Trust:** Distinguish sourced facts from general explanation; identify source material and uncertainty.
- **Learning:** Encourage the student to reason and practise, not only copy an answer.
- **Privacy:** Collect the minimum data needed for the pilot and explain its use in plain language.
- **Accessibility:** Support keyboard use, readable contrast, captions/transcripts for media, and mobile layouts.
- **Reliability:** Fail safely when uploads, retrieval, or model calls fail; never imply a failed answer is verified.
- **Cost awareness:** Log usage and enforce per-user limits before inviting a larger group.
- **Ease of use:** Use plain language, a predictable flow, readable layouts, accessible controls, and age-appropriate explanation depth.
- **Profile personalization:** After sign-in, greet the learner using their preferred display name (for example, “Good afternoon, Ayesha”). Do not require a legal name or exact date of birth just to personalize the greeting.
- **Child safety:** Do not onboard primary or secondary school learners until the safeguarding, consent, moderation, and support model has been reviewed for the intended country and partner schools.

## 7. Learning insights and responsible improvement

UniAI can use learning patterns to find topics where learners commonly get stuck. It must distinguish personal learning support from product-wide analytics:

- Keep a learner's own progress private and use it only to personalize that learner's study experience.
- For product insights, collect only the minimum events needed (for example: topic identifier, activity type, outcome band, content version, and optional feedback category). Do not place uploaded document text, names, raw questions, or free-form answers in analytics events.
- Use aggregated, access-controlled reports and suppress results for small groups where individuals could be inferred. Explain the analytics purpose clearly and obtain the appropriate permission before collecting it.
- Do not train or fine-tune a model on student documents, questions, or answers by default. First use aggregate patterns to identify content gaps; educators review and improve explanations and questions, then the team evaluates those changes before release.
- Keep content provenance and versions so the team can tell which sources and materials led to a learning resource.

This creates a deliberate improvement loop; student activity does not automatically make a general AI model learn or become more accurate.

## 8. Pilot evidence

Track activation (first material plus first lesson/quiz), repeat use, source relevance, unsupported-answer reports, quiz completion, user feedback, service failures, and AI cost per active learner. Compare learning checks only with fresh, comparable questions and interpret results cautiously. Interview both repeat users and people who stop returning.

Do not set success targets until a baseline and pilot scope are agreed. A pilot report should guide whether to improve the learning loop, change the audience, or expand features.

## 9. Decisions to confirm during discovery

- Which two or three modules have willing students and permissioned learning content?
- Who reviews the educational quality of lessons and generated questions?
- What age range will be admitted to the pilot?
- What data retention period is acceptable, and who can administer deletion requests?
- What independent brand/name can be used while university naming and trademark questions are reviewed?
- Which generated formats help students learn best, and which are worth the extra video generation cost?
- Which reminder channels and quiet hours should the student control?
- Which age/grade bands and reading levels should the first age-adaptive experience support?
- What child safeguarding, competent-person consent, school approval, and support processes are required before a younger-learner pilot?
- What minimum group size and retention period will protect privacy in aggregated struggle reports?
- What score defines a pass for each learner stage and assessment type? A 50% threshold can be the initial setting, then validated with educators and learners.
