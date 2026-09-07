import {
  LEGAL_CONTACT_EMAIL,
  PRIVACY_POLICY_VERSION,
  TERMS_OF_SERVICE_VERSION
} from './constants'

export type LegalDocumentType = 'privacy' | 'terms'

interface LegalSection {
  heading: string
  paragraphs?: string[]
  bullets?: string[]
}

const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: '1. Scope and operator',
    paragraphs: [
      'This Privacy Policy explains how Sentia collects, uses, stores, and discloses information when you use the Sentia website, notebook editor, study tools, artificial-intelligence features, feedback system, imports, exports, and related services.',
      `Sentia is currently operated as an independent project. Questions or privacy requests may be sent to ${LEGAL_CONTACT_EMAIL}.`
    ]
  },
  {
    heading: '2. Information you provide',
    bullets: [
      'Account information: your email address and authentication identifiers. If you use Google sign-in, Sentia may also receive basic profile information made available through the requested authentication scope, such as your name and profile image. Sentia does not request access to your Google Drive or Google Docs.',
      'Notebook information: notebook names, page titles, page text, formatting, page order, drawings, and other content you create or import.',
      'AI information: questions, instructions, selected text, page or notebook context sent with an AI request, generated responses, citations, and derived notebook chunks, content hashes, or embeddings used to retrieve relevant notes.',
      'Agent-integration information: when you authorize an external agent through Sentia’s OAuth consent screen, that client may receive the notebook names, page titles, page content, and revision metadata needed for the permissions shown to you. Authorized agents may create pages, append content, or replace a page after explicit client approval on your behalf. Sentia does not give the agent database credentials or service-provider secret keys.',
      'Feedback information: feedback category, message, optional rating, permission to contact you, and optional technical context such as the page path and a shortened browser user-agent string.',
      'Imported information: text extracted from supported files and folders. Sentia stores the converted notebook or page content; the original local file is not intentionally retained as a separate uploaded file.',
      'Local Markdown mirror information: when you voluntarily connect a local folder, your browser grants Sentia a directory handle and Sentia writes notebook pages, page identifiers, titles, ordering metadata, and a .sentia.json ownership manifest to that folder. Connecting a folder does not by itself upload unrelated files from that folder to Sentia.',
      'Communications: information you include when contacting the operator by email or another support channel.'
    ]
  },
  {
    heading: '3. Information collected automatically',
    bullets: [
      'Authentication cookies and session data needed to keep you signed in and protect your account.',
      'Local and session storage preferences, including application theme, dashboard view, tutorial completion, default notebook name, pending recovery or deletion state, and an optional local-folder directory handle stored in browser IndexedDB.',
      'Basic request and security information needed to operate APIs, enforce usage limits, detect abuse, and diagnose failures. Rate-limit records use authenticated account identifiers and request-route information.',
      'Dates associated with accounts, notebooks, pages, feedback, legal acceptance, and recent notebook activity.'
    ]
  },
  {
    heading: '4. How information is used',
    bullets: [
      'Authenticate users and maintain account sessions.',
      'Create, save, organize, search, import, export, and display notebooks and pages.',
      'Autosave changes, recover supported deletions, and protect notebook integrity.',
      'Create and maintain an optional one-way Markdown mirror in a folder you explicitly authorize on your device.',
      'Generate AI explanations, summaries, rewrites, fact checks, study quizzes, citations, and other requested assistance.',
      'Build and query notebook embeddings so AI responses can use relevant portions of your notes.',
      'Analyze non-content writing characteristics, such as sentence and paragraph length, structural formatting, and punctuation patterns, when you request Continue or Rewrite so generated notes can better match the current page. This transient style description is not stored as a user profile.',
      'Provide notebook information and carry out bounded notebook changes when you explicitly authorize a compatible external agent integration.',
      'Respond to feedback and contact users who explicitly permit follow-up.',
      'Apply security controls, usage limits, authorization checks, fraud prevention, debugging, and service maintenance.',
      'Comply with legal obligations and enforce the Terms of Service.'
    ]
  },
  {
    heading: '5. Sources and legal bases for processing',
    paragraphs: [
      'Sentia receives information directly from you, from your browser or device when you use the service, and from an authentication provider when you choose provider-based sign-in.',
      'Where data-protection law requires a legal basis, Sentia processes account and notebook information as necessary to provide the service and perform its agreement with you; processes security, rate-limit, reliability, and abuse-prevention information for legitimate interests in protecting and operating the service; processes information when necessary to comply with law; and relies on consent where the interface specifically requests optional permission, such as permission to contact you about feedback. You may withdraw an optional consent prospectively by contacting the operator, without affecting processing that occurred before withdrawal.'
    ]
  },
  {
    heading: '6. AI processing and external research',
    paragraphs: [
      'Sentia does not create or refresh notebook embeddings merely because you open or edit a notebook. When you invoke an AI feature such as Ask AI or Generate Quiz, Sentia extracts text from the latest notebook content saved to the server, divides it into chunks, compares content hashes, and sends new or changed chunk text to OpenAI to create embeddings. Sentia stores the resulting chunks, hashes, and vectors in its database so unchanged content can be reused on later AI requests. Those derived records may remain until their source page or notebook is deleted or another applicable retention action occurs.',
      'When you request an AI feature, Sentia may also send the necessary prompt, instructions, and retrieved page or notebook context to OpenAI through its API. OpenAI states that API inputs and outputs are not used to train its models by default unless the API customer opts in. Under OpenAI’s standard API data controls, request content may be retained in abuse-monitoring logs for up to 30 days, and some API features may retain application state according to OpenAI’s then-current configuration and policies. Sentia does not control provider-side retention required by law or provider security processes.',
      'Some actions, including fact checking and externally sourced rewriting or research, may use OpenAI web-search capabilities. Those responses may include links to third-party sources. Third-party websites have their own privacy practices, and Sentia is not responsible for their content or policies.',
      'AI output may be inaccurate, incomplete, or inappropriate. Do not place sensitive personal information in a notebook or prompt unless it is necessary and you understand that it may be processed by the AI provider.'
    ]
  },
  {
    heading: '7. Authorized agent integrations',
    paragraphs: [
      'Sentia may allow you to connect a compatible external agent using OAuth. Before access is granted, Sentia displays the requesting client and the categories of notebook operations available. The external client then processes information under its own terms and privacy practices; authorize only clients you trust.',
      'The initial agent integration can list notebooks and pages, read page content, create pages, append formatted content, and replace page content after explicit approval in the connected client. Whole-page replacement is marked destructive and protected by revision checks. The integration does not expose account operations, deletion, or Sentia AI requests. You may revoke an OAuth grant through available account or provider controls. Revocation stops future authorized access but does not retrieve information already received by the external client.'
    ]
  },
  {
    heading: '8. Service providers and disclosures',
    paragraphs: [
      'Sentia does not currently sell personal information, rent personal information, or use notebook content for targeted advertising.'
    ],
    bullets: [
      'Supabase provides authentication and related account-session services.',
      'A PostgreSQL database and deployment or infrastructure providers store and serve application information.',
      'OpenAI processes AI prompts, relevant notebook context, generated output, embeddings, and supported web-search requests.',
      'Google provides OAuth authentication when you choose Google sign-in.',
      'Information may be disclosed when reasonably necessary to comply with law, protect users or the service, investigate abuse, or respond to valid legal process.',
      'Information may be transferred as part of a merger, acquisition, financing, reorganization, or sale of the project, subject to appropriate notice and applicable law.'
    ]
  },
  {
    heading: '9. Cookies and browser storage',
    paragraphs: [
      'Sentia uses authentication cookies and browser storage that are necessary for sign-in, security, preferences, tutorials, view settings, recovery behavior, and optional local-folder connections. A connected directory handle remains subject to browser and operating-system permissions. You may disconnect it in Sentia or revoke the site permission in your browser. Disconnecting or revoking permission does not delete Markdown files already written to your device. Sentia does not currently operate third-party advertising cookies or an independent behavioral-analytics system. If nonessential tracking is introduced, this policy and any required consent controls must be updated before that tracking is enabled.'
    ]
  },
  {
    heading: '10. Retention',
    paragraphs: [
      'Account and notebook information is generally retained while your account remains active or as needed to provide the service. Active-database page chunks and embeddings are deleted through database relationships when their source page or notebook is deleted. Feedback may be retained while it remains useful for evaluating, documenting, or resolving the submission. Legal-acceptance records are retained with the account to document the versions accepted. Authentication, infrastructure, backup, and AI-provider records are subject to the applicable provider’s retention schedules.',
      'Using Delete Account in dashboard Settings removes the active application account and its associated server-stored notebooks, pages, chunks, embeddings, drawings, feedback, and legal-acceptance records, and requests deletion of the associated Supabase authentication identity. Database rate-limit records tied to the account are also removed. Sentia retains a one-way hash of the deleted authentication identifier for up to 24 hours to prevent an already-issued session token from recreating the account; the hash is then eligible for deletion. Deletion otherwise remains subject to backup cycles, security needs, legal obligations, dispute preservation, and service-provider retention rules.',
      'Account deletion does not remove exported files, local Markdown copies, or other copies you saved outside Sentia. Sentia clears its stored browser directory handles when deletion completes, but files already written to your device remain under your control.'
    ]
  },
  {
    heading: '11. Security',
    paragraphs: [
      'Sentia uses authentication, authorization checks, request validation, same-origin protections, rate limits, database relationships, and other safeguards intended to protect information. No internet service can promise absolute security. You are responsible for protecting your sign-in credentials, using a secure device, and promptly reporting suspected unauthorized access.'
    ]
  },
  {
    heading: '12. Your choices and privacy rights',
    bullets: [
      'You may edit or delete notebooks and pages using the available product controls.',
      'You may export supported notebook and page content in available formats.',
      'You may decline local-folder access, disconnect a connected folder, or revoke filesystem permission through your browser. Local mirror files already created remain under your control on your device.',
      'You may decline optional feedback context and decline permission to be contacted.',
      'You may avoid AI processing by not invoking AI features.',
      'You may decline an external agent authorization request or revoke an OAuth grant. Revocation does not delete copies already processed by that client.',
      'You may delete your account and associated active server data through dashboard Settings. This action cannot be undone, and local or exported copies remain outside Sentia.',
      `Depending on where you live, you may have rights to request access, correction, deletion, restriction, objection, or portability; to withdraw consent where processing depends on consent; and to appeal or complain to an appropriate regulator. Use the available account controls or submit a request by emailing ${LEGAL_CONTACT_EMAIL}. Sentia may need to verify the request and may retain information where permitted or required by law.`
    ]
  },
  {
    heading: '13. Sales, targeted advertising, and automated decisions',
    paragraphs: [
      'Sentia does not currently sell personal information, share it for cross-context behavioral advertising, or use it for targeted advertising. Sentia does not use personal information to make solely automated decisions that produce legal or similarly significant effects. If these practices change, Sentia will update this policy and provide any controls required by applicable law before the new practice begins.'
    ]
  },
  {
    heading: '14. Children',
    paragraphs: [
      'Sentia is not directed to children under 13, and users under 13 may not create or use an account. If you are under the age of legal majority where you live, you may use Sentia only with permission from a parent or legal guardian. If the operator learns that information from a child under 13 was collected without legally sufficient authorization, reasonable steps will be taken to delete it.'
    ]
  },
  {
    heading: '15. International processing',
    paragraphs: [
      'Sentia and its providers may process information in the United States and other countries. Those locations may have data-protection rules different from those where you live. Where applicable law requires additional transfer protections, Sentia will use appropriate measures available to the service.'
    ]
  },
  {
    heading: '16. Policy changes',
    paragraphs: [
      'This policy may change as Sentia develops. The effective date and version will be updated when changes are published. Material changes may require renewed in-app acceptance. Continuing to use the service after an effective update constitutes acceptance where permitted by law.'
    ]
  },
  {
    heading: '17. Contact',
    paragraphs: [
      `Privacy questions and requests may be sent to ${LEGAL_CONTACT_EMAIL}. Include enough detail to identify the account and request, but do not send passwords or unnecessary sensitive information.`
    ]
  }
]

const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: '1. Agreement',
    paragraphs: [
      'These Terms of Service govern access to and use of Sentia. By creating an account, selecting the acceptance controls, or using the authenticated service, you agree to these Terms and acknowledge the Privacy Policy. If you do not agree, do not use Sentia.',
      'Sentia is currently an independent project and may change substantially as it develops.'
    ]
  },
  {
    heading: '2. Eligibility',
    paragraphs: [
      'You must be at least 13 years old to use Sentia. If you are under the age of legal majority where you live, you represent that a parent or legal guardian has reviewed and agreed to these Terms on your behalf. You may not use the service if applicable law prohibits you from doing so.'
    ]
  },
  {
    heading: '3. Accounts',
    bullets: [
      'Provide accurate account information and keep it current.',
      'Maintain the confidentiality and security of your credentials and devices.',
      'Password recovery links are time-limited account credentials. Do not share or forward them.',
      'Do not share, transfer, sell, or misuse an account.',
      'Notify the operator promptly if you believe an account has been compromised.',
      'You are responsible for activity performed through your account unless applicable law provides otherwise.'
    ]
  },
  {
    heading: '4. Your content',
    paragraphs: [
      'You retain ownership of notebook content and other material you submit, to the extent you have ownership rights. You grant Sentia a limited, nonexclusive, worldwide license to host, copy, process, transmit, format, index, create technical derivatives such as chunks and embeddings, and display that content solely as needed to operate, secure, and support the service and provide features you request.',
      'You represent that you have the rights and permissions necessary to submit the content and that its use through Sentia will not violate law or the rights of another person. Do not upload confidential, regulated, copyrighted, or personal information unless you are authorized to do so.'
    ]
  },
  {
    heading: '5. AI features',
    paragraphs: [
      'AI features may analyze notebook content and produce explanations, summaries, rewrites, fact checks, quizzes, citations, or draft notes. AI output is generated probabilistically and may be wrong, fabricated, outdated, biased, incomplete, or unsuitable.',
      'You must review AI output before relying on it or adding it to a notebook. Sentia does not provide legal, medical, financial, mental-health, academic-integrity, or other professional advice. You remain responsible for decisions, submissions, citations, and work created with the service.',
      'Invoking an AI feature authorizes Sentia to send the content reasonably needed for that request to its identified AI provider and to store derived chunks, hashes, and embeddings as described in the Privacy Policy. Provider processing and retention are governed by the provider’s applicable terms and data controls.',
      'AI availability and usage allowances may be limited to control cost, misuse, and system load. Limits may change without guaranteeing a particular quantity of requests.'
    ]
  },
  {
    heading: '6. Acceptable use',
    bullets: [
      'Do not violate law, regulations, sanctions, or another person’s rights.',
      'Do not use Sentia to create, store, or distribute malware, fraudulent material, unlawful threats, exploitation, or content that facilitates serious harm.',
      'Do not attempt to gain unauthorized access to accounts, databases, APIs, prompts, infrastructure, or security controls.',
      'Do not bypass rate limits, usage restrictions, authorization checks, or technical protections.',
      'Do not scrape, overload, reverse engineer, disrupt, or interfere with the service except where applicable law expressly permits.',
      'Do not impersonate another person, misrepresent affiliation, or submit content you are not authorized to use.',
      'Do not use AI output as a substitute for required independent work or disclosure under school, employer, or professional rules.'
    ]
  },
  {
    heading: '7. Imports, exports, and third-party services',
    paragraphs: [
      'You are responsible for verifying imported and exported content, formatting, pagination, file compatibility, and backups. Imports may overwrite the active page when the interface states that they will. Exports may reflow or divide content to fit the selected format.',
      'The optional local Markdown mirror is one-way: the server-saved Sentia notebook remains authoritative. Sentia may create, update, rename, or delete only Markdown files identified in its local .sentia.json manifest. Changes made directly to mirrored files outside Sentia may be overwritten and are not imported back into the notebook. Disconnecting leaves existing local files in place. You are responsible for reviewing local output and maintaining independent backups or version control.',
      'If you authorize an external agent through Sentia’s OAuth consent screen, you are responsible for reviewing the client identity, its requested access, and changes it performs. Agent writes are treated as actions authorized through your account. Sentia may restrict available tools, require current revision information, reject conflicting writes, rate limit access, or revoke integration availability to protect users and the service.',
      'Sentia relies on third-party services including Supabase, Google, OpenAI, hosting infrastructure, and linked research sources. Your use of those services may also be subject to their terms and policies. Sentia is not responsible for third-party websites, interruptions, or content.'
    ]
  },
  {
    heading: '8. Service changes and availability',
    paragraphs: [
      'Sentia may add, modify, limit, suspend, or discontinue features at any time. The service may experience errors, maintenance, data loss, security incidents, or outages. No uptime, permanence, storage, compatibility, or continued-availability guarantee is made.',
      'Keep independent backups of important content. Autosave, undo, recovery, import, export, and synchronization features are conveniences and are not guaranteed backup systems.'
    ]
  },
  {
    heading: '9. Suspension and termination',
    paragraphs: [
      `Access may be restricted or terminated when reasonably necessary to protect the service or users, investigate suspected misuse, comply with law, or address a material violation of these Terms. You may stop using Sentia at any time and may delete your account through dashboard Settings. If the self-service control is unavailable, contact ${LEGAL_CONTACT_EMAIL}.`,
      'Account deletion is intended to remove the active Sentia account and associated server-stored content, but it does not delete exports, local Markdown files, or other copies outside Sentia. Some provider, backup, security, or legally required records may persist for the periods described in the Privacy Policy.',
      'Provisions that by their nature should survive termination—including ownership, licenses necessary for prior operation, disclaimers, limitations, and dispute provisions—will survive.'
    ]
  },
  {
    heading: '10. Intellectual property',
    paragraphs: [
      'Sentia’s software, design, branding, and service materials are owned by the operator or applicable licensors and are protected by intellectual-property laws. These Terms do not grant permission to use Sentia branding or proprietary material except as necessary to use the service.'
    ]
  },
  {
    heading: '11. Disclaimers',
    paragraphs: [
      'TO THE MAXIMUM EXTENT PERMITTED BY LAW, SENTIA IS PROVIDED “AS IS” AND “AS AVAILABLE,” WITHOUT WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, ACCURACY, RELIABILITY, AVAILABILITY, OR DATA PRESERVATION. SOME JURISDICTIONS DO NOT ALLOW CERTAIN DISCLAIMERS, SO SOME OF THESE TERMS MAY NOT APPLY TO YOU.'
    ]
  },
  {
    heading: '12. Limitation of liability',
    paragraphs: [
      'TO THE MAXIMUM EXTENT PERMITTED BY LAW, SENTIA AND ITS OPERATOR WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOST DATA, PROFITS, OPPORTUNITIES, GOODWILL, OR BUSINESS INTERRUPTION ARISING FROM THE SERVICE.',
      'TO THE MAXIMUM EXTENT PERMITTED BY LAW, TOTAL LIABILITY ARISING FROM SENTIA WILL NOT EXCEED THE GREATER OF THE AMOUNT YOU PAID FOR THE SERVICE DURING THE TWELVE MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM OR ONE HUNDRED U.S. DOLLARS. THESE LIMITATIONS DO NOT APPLY WHERE LIABILITY CANNOT LEGALLY BE LIMITED.'
    ]
  },
  {
    heading: '13. Indemnity',
    paragraphs: [
      'To the extent permitted by law, you agree to defend and indemnify the operator from third-party claims, damages, and reasonable costs arising from your unlawful use of Sentia, your content, or your material violation of these Terms. This section does not require indemnification where prohibited by applicable law.'
    ]
  },
  {
    heading: '14. Disputes and applicable law',
    paragraphs: [
      'Before filing a formal claim, you agree to contact the operator and attempt in good faith to resolve the issue informally. Applicable law and the forum for any dispute will be determined by otherwise applicable conflict-of-law and jurisdiction rules. These Terms do not waive consumer rights that cannot legally be waived.'
    ]
  },
  {
    heading: '15. Changes to these Terms',
    paragraphs: [
      'These Terms may be updated as the service changes. The effective date and version will be updated, and material changes may require renewed acceptance. If you do not agree to updated Terms, you must stop using the authenticated service.'
    ]
  },
  {
    heading: '16. General terms',
    paragraphs: [
      'If a provision is found unenforceable, it will be limited to the minimum extent necessary and the remaining provisions will continue in effect. Failure to enforce a provision is not a waiver. You may not assign these Terms without permission; the operator may assign them in connection with a transfer of the project. These Terms and the Privacy Policy form the entire agreement concerning Sentia unless a separate written agreement applies.'
    ]
  },
  {
    heading: '17. Contact',
    paragraphs: [
      `Questions, notices, and account requests may be sent to ${LEGAL_CONTACT_EMAIL}. Do not send passwords or unnecessary sensitive information.`
    ]
  }
]

export function LegalDocumentContent({
  document
}: {
  document: LegalDocumentType
}) {
  const isPrivacy = document === 'privacy'
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS
  const version = isPrivacy
    ? PRIVACY_POLICY_VERSION
    : TERMS_OF_SERVICE_VERSION

  return (
    <article className="text-sm leading-6 text-slate-300">
      <header className="mb-6 border-b border-slate-800 pb-5">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-sky-300">
          SENTIA LEGAL
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">
          {isPrivacy ? 'Privacy Policy' : 'Terms of Service'}
        </h1>
        <p className="mt-2 text-xs text-slate-500">
          Effective September 2, 2026 · Version {version}
        </p>
      </header>

      <div className="space-y-7">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-base font-semibold text-slate-100">
              {section.heading}
            </h2>
            {section.paragraphs?.map((paragraph) => (
              <p className="mt-2" key={paragraph}>
                {paragraph}
              </p>
            ))}
            {section.bullets && (
              <ul className="mt-3 list-disc space-y-2 pl-5">
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </article>
  )
}
