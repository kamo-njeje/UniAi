# Security and privacy baseline

This is a starting engineering checklist, not a guarantee that a system is secure or compliant. Review it as the product and pilot data change.

## Before real users

- Use synthetic data for development and demos.
- Do not collect student numbers, grades, or other sensitive records unless a documented need and approved safeguards exist.
- Publish a plain-language privacy notice covering collected data, purpose, retention, providers, and deletion contact/process.
- Decide who can access pilot data and require individual accounts; do not share administrator credentials.
- Store secrets outside source control and rotate any secret that is accidentally exposed.
- Require HTTPS in hosted environments; use secure, HTTP-only, appropriately configured session/auth cookies if cookies are used.
- Use a maintained identity framework for passwords and account sessions; never store or log plaintext passwords. Verify email or phone ownership, use short-lived one-time SMS codes, rate-limit sign-up/sign-in/recovery, and avoid responses that expose whether an account exists.
- For Google sign-in, request only the minimum identity scopes and validate the OAuth state/nonce and token issuer/audience on the server. Never put client secrets in the React app.
- Validate file type by content as well as extension, cap upload size, scan uploads where available, and keep files private.
- Treat uploaded documents and extracted text as untrusted input. Defend AI prompts against embedded instructions and prevent one user's content from appearing in another user's answer.
- In broader-knowledge mode, do not send whole uploaded files or learner identifiers to public search. Keep retrieved web pages as untrusted input, display the actual clickable citations, and separate external claims from claims grounded in the learner's material.
- Keep document-generation routes unavailable outside Development until authentication, authorization, institution boundaries, production rate limits, provider review, and privacy notices are in place.
- Enforce server-side authorization on every read, write, download, and delete.
- Avoid logging passwords, tokens, full documents, or unnecessary personal details. Use request IDs and security-relevant audit events.
- Add rate limits, upload quotas, model usage limits, and abuse reporting before widening access.
- Back up production data securely and practise restoration before relying on those backups.
- Keep dependencies and the operating environment supported; review dependency and vulnerability alerts.
- Before any primary/secondary school pilot, complete a country-specific review of child privacy, guardian/competent-person permission, school approval, safeguarding, and incident handling. The South African Information Regulator publishes guidance on processing children's personal information under POPIA; obtain qualified local advice for the planned data flows and any cross-border AI provider.
- Before a real-data pilot, map UniAI's and each institution/provider's responsible-party and operator roles, lawful purposes, notices, retention, data-subject request handling, and cross-border transfers. Assess whether any planned flow requires prior authorisation.
- Keep aggregate learning analytics separate from source documents and identifiable learner records. Pseudonymized data can still be personal information; control access, retention, purpose, and re-identification risk.
- Do not automatically train or fine-tune models on student materials or interactions. Use a documented, separately permissioned process if that ever becomes a proposed use.
- Provide age-appropriate output safeguards and clear escalation paths for harmful or alarming content; do not expose younger learners to open peer messaging in the initial design.

## AI answer safeguards

- Provide source references for answers based on course material.
- Say when relevant evidence was not found; do not fabricate citations.
- Separate retrieved source text from trusted system instructions.
- Do not send more personal or course data to an AI provider than needed.
- Make it easy for a learner to flag a wrong or harmful answer.
- Review generated quizzes before using them for consequential grading; the MVP is for practice, not official assessment.
