# Technical blueprint

**Status:** Starting recommendation; confirm details as the first slice is built.

## 1. Recommended stack

- **Web client:** React + TypeScript, built with a current, supported Node.js LTS release.
- **API:** ASP.NET Core Web API on the installed .NET 10 SDK.
- **Database:** SQL Server with Entity Framework Core migrations.
- **Document storage:** Private object storage in production; local-only storage for development. Keep uploaded files out of the public web root.
- **AI integration:** A server-side provider adapter. The browser never receives provider secrets. Add retrieval over a student's selected documents before enabling course-grounded answers.
- **Source control:** Git, with a private GitHub repository when the founder is ready to create one.
- **Local services:** Docker Desktop is available, but is optional for the first setup. Use it when we need a repeatable local SQL Server or storage service.

The machine currently has Git, Node.js v24.21.0/npm 11.19.0, .NET SDK 10.0.203 and 10.0.401, VS Code, and Docker Desktop. No additional installation is needed before creating the first project skeleton. Keep project dependencies on supported releases and record exact versions in the repository as they are selected.

## 2. Architecture pattern

Begin with a **modular monolith**: one web client, one API, one relational database, and clear internal feature boundaries. This keeps deployment and troubleshooting manageable while preserving room to split services if actual scale requires it.

Suggested modules:

- Identity and profiles
- Modules and learning materials
- Tutor and source retrieval
- Practice and progress
- Administration and audit

Keep organization and institution identifiers in the data model so content and learner records can be separated by school/university when multi-institution support is added. Enforce tenant boundaries in the API/data-access layer from the first persisted feature; never rely on a client-provided institution ID without authorization.

Learner experience settings should use the minimum useful level of detail (for example, education stage, grade band, and chosen reading level). Avoid collecting birth dates unless the approved safeguarding and consent design requires them.

The signed-in profile should expose a preferred `displayName` for the greeting. The web app should read it from the authenticated profile response; do not treat a browser-only name field as account registration.

Persist modules, study progress, and timeline items on the server under the authenticated learner's account. Guest preview data may live only in session-scoped browser storage and must be cleared at the end of that session; it must never be presented as account-saved data. Every server query must enforce ownership and institution boundaries.

Before implementing real accounts, uploads, analytics, or AI-provider calls, follow [the privacy plan](privacy-plan.md) to map each data flow, responsible-party/operator roles, purposes, retention, permissions, and cross-border processing.

Request flow:

`React UI → ASP.NET Core API → application/service layer → domain rules → EF Core/data store`

AI calls go through a server-side tutor service and provider interface. The tutor service retrieves only material the current user is allowed to access, sends a bounded context to the model, and returns an answer plus source references. It must not trust instructions embedded in uploaded documents as system instructions.

## 3. Code patterns and conventions

- Keep controllers/endpoints thin: validate the request, call an application service, return a typed response.
- Put business rules in feature services/domain logic, not in React components or database controllers.
- Use DTOs at the API boundary; never serialize database entities directly to the client.
- Use async I/O, cancellation tokens, structured logging, and consistent error responses.
- Enforce authorization on the server for every document and study record lookup; hiding a UI button is not authorization.
- Use EF Core migrations for schema changes; do not edit a production database schema manually.
- Use configuration for non-secret settings and environment/user secrets for credentials. Commit only an `.env.example` with dummy values if needed.
- Use feature folders and descriptive names; avoid premature generic frameworks and microservices.
- Keep API contracts explicit and version changes deliberately.
- Add automated checks alongside each feature before treating it as ready for pilot users.

Example repository shape (we can create this in the first implementation slice):

```text
uniai/
  docs/
  src/
    web/                 # React + TypeScript
    api/                 # ASP.NET Core
  tests/
    api.tests/
    web.tests/
  .gitignore
  README.md
```

## 4. First implementation slices

1. **Foundation (complete):** Git, web/API skeleton, health endpoint, and local run experience.
2. **Learning shell:** university-neutral modules, module detail, topic selection, and responsive navigation using sample data.
3. **Permissioned content (local development slice):** accept PDF, PPTX, DOCX, and TXT; enforce size/count limits; extract text in memory; do not persist uploads. The current generation endpoint is Development-only, origin-checked, and rate-limited. Add authenticated, tenant-scoped private storage before any hosted pilot.
4. **Study-mode choice and grounded pack:** after processing, offer “Summary and practice” (uploaded material only) or “Broaden my knowledge” (uploaded material plus related web research). Ask before provider transmission. Keep web and course sources distinct, show clickable citations, use topic-level search terms, and handle unsupported questions clearly.
5. **Video lessons:** generate a reviewed script/storyboard and accessible narrated lesson from selected material; evaluate cost and quality before richer video.
6. **Personal timeline:** let students add study sessions and due dates, then send opt-in reminders with user-controlled timing.
7. **Pilot hardening:** accessibility, privacy notice, deletion path, usage limits, monitoring, and a limited invited pilot.

8. **Learning insights:** record minimal, pseudonymous activity events separately from uploaded content; aggregate topic-level difficulty patterns; suppress small cohorts; and feed findings into educator-reviewed, versioned content improvements. Do not use raw student documents or answers for model training by default.

9. **Topic checkpoint:** let the learner start an exam after studying. Score it, identify missed concepts, provide targeted source-backed explanations, and create a fresh retry. Repeat this teaching-and-retry loop until the configured pass mark is reached. Do not impose the former five-prompt limit. Store exam attempts and outcomes under the authenticated learner and module; support educator-configured pass marks by age/stage.

Do not connect student records or institutional systems in these slices.

## 5. Definition of ready for a feature

A feature is ready to show pilot users when its expected behavior is written down, access rules are enforced by the API, errors are understandable, sensitive data is not logged, relevant automated checks pass, and the change is reviewed and committed. A feature that calls an AI model also needs source-quality checks and a way to report a bad answer.
