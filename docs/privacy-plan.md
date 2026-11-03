# UniAI privacy plan (working draft)

**Purpose:** Set privacy decisions before UniAI handles real learner materials or personal information. This is a product design draft, not a legal opinion or a completed POPIA assessment.

## 1. Start with purpose and roles

Before a pilot, document each purpose for processing and decide who determines that purpose and the means of processing. UniAI may be the responsible party for a direct-to-student service; a school/university may be the responsible party for an institution-sponsored service, with UniAI acting as an operator for some processing. The actual roles depend on the arrangements, not the labels in a contract. Record the roles and responsibilities with local privacy counsel and the partner institution.

## 2. Proposed data boundaries

| Data | Why it may be needed | Proposed boundary |
|---|---|---|
| Account and learner settings | Sign-in, chosen school/course, learner experience | Collect only necessary fields. Store a preferred display name for the greeting; do not require a legal name. Prefer education stage/grade band and chosen reading level over exact birth date. |
| Uploaded slides and documents | Create the learner's study resources | Private to the learner or authorized class space; access checked on every request; retain only while needed and provide deletion. |
| AI request context | Answer a question or create a resource | Send only relevant excerpts and the minimum context; do not send unrelated account or progress data. Review provider retention, training, security, and transfer terms first. For public web search, use topic-level terms rather than forwarding full uploaded documents or learner identifiers. |
| Personal progress | Show the learner their own mastery and next study suggestions | Keep separate from institution-wide analytics; do not expose identifiable learner profiles to school staff by default. |
| Learning insight events | Find topics or resource types where learners struggle | Use minimal pseudonymous events such as topic, activity type, outcome band, and content version. Exclude document text, raw answers, names, and free-text queries. |
| Aggregated reports | Improve reviewed lessons and questions | Restrict access, suppress small groups, document retention, and assess whether a learner could still be identified. Do not describe data as anonymous unless re-identification is not reasonably possible. |

Guest preview is temporary: use session-scoped storage only and clear it when the session ends. Long-term learning records belong in authenticated, server-side account storage with a clear account deletion path.

In the current development slice, the API reads document files in memory, extracts text, and sends that text to OpenAI only after the learner confirms a study mode. UniAI does not persist the uploaded file or generated response. This development path is not approved for real student or child data; provider and legal review must precede any real-data pilot.

For account creation, offer Google OAuth, email/password, or SMS verification as alternatives. Request only the Google identity scopes needed for sign-in; do not ask for access to Gmail or Drive. Do not require a phone number for email or Google sign-up. Treat phone numbers and email addresses as personal information, keep usernames private by default, and do not reveal whether an account exists in sign-in or recovery responses. SMS one-time codes need short expiry, one-time use, attempt limits, and abuse controls. Keep all provider secrets on the server.

These are starting design boundaries. Confirm necessity, legal basis, retention, and notice wording for each real data flow before collection.

## 3. Younger learners

Do not invite primary or secondary learners into a real-data pilot until the team has completed a country-specific child privacy and safeguarding review. In South Africa, POPIA section 34 generally prohibits processing a child's personal information subject to section 35 exceptions, including prior consent of a competent person. Some situations require additional analysis or Information Regulator authorisation. Determine the applicable route for the actual product and data flow with qualified local advice; do not treat a checkbox or a school's participation as automatic permission for every use.

The younger-learner product should have a plain-language child notice, a separate adult/guardian or school process where required, minimal profile data, age-appropriate AI safeguards, no open peer messaging, and a clear route for access, correction, deletion, and concerns.

## 4. AI provider and cross-border review

Before connecting an AI or file-processing provider, list what data leaves UniAI, where it is processed, how long it is retained, who can access it, whether it is used for provider model training, and what subprocessors are involved. Contractually disable provider training on learner content where available. Assess POPIA operator obligations and cross-border transfer rules. The Information Regulator identifies prior-authorization cases under section 57, including certain transfers of children's or special personal information to foreign recipients without adequate protection; assess whether a planned provider flow falls within those rules.

## 5. Improve the learning product without training on private work

Use privacy-reviewed aggregate trends to identify content gaps. An educator or subject reviewer then revises the source-backed explanation, quiz, or video script. Version the resource and evaluate it with fresh, comparable questions before release. Do not fine-tune a general model on raw student documents, questions, or answers by default. If model training is ever proposed, make it a separate purpose with a new legal and privacy review, specific permissions, and a withdrawal/retention plan where applicable.

## 6. Before the first real-data pilot

- Map data from collection through storage, model providers, analytics, backups, and deletion.
- Determine responsible-party/operator roles, lawful grounds, notices, data-subject processes, and any prior-authorization requirement.
- Complete a privacy risk assessment and security review with the intended institution and qualified South African counsel.
- Set and enforce retention periods; test deletion across primary storage, derived resources, logs, and backups.
- Use access controls, encryption, secure file handling, redacted logs, incident response, and written provider/operator terms.
- Start with adult university volunteers and permissioned course content; use synthetic data while building.
- Add children only after the child-specific safeguards, permissions, institution agreements, and support process are ready.

## Official references

- [Protection of Personal Information Act 4 of 2013 (South African Government)](https://www.gov.za/documents/protection-personal-information-act)
- [Information Regulator guidance on processing children's personal information](https://inforegulator.org.za/wp-content/uploads/2020/07/GuidanceNote-Processing-PersonalInformation-Children-20210628-1.pdf)
- [Information Regulator: prior authorisation](https://inforegulator.org.za/prior-authorisation/)
