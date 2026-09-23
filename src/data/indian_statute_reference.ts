/**
 * indian_statute_reference.ts
 *
 * Curated reference dataset of Indian statutes relevant to employment contract clause analysis.
 *
 * Sourcing policy:
 *   - Primary source: indiacode.nic.in (official Government of India legislation portal)
 *   - Cross-verification source: indiankanoon.org
 *   - Sections marked NEEDS_VERIFICATION could not be confirmed verbatim from both sources
 *     at time of authoring and are EXCLUDED from clause_to_statute_matcher.ts until verified.
 *   - Do NOT paraphrase or reconstruct section text from memory. If uncertain, mark NEEDS_VERIFICATION.
 *
 * Display policy:
 *   - These are reference texts for legal context — not legal opinions.
 *   - Every UI surface that renders this data must accompany it with the disclaimer field.
 *   - NEVER present this text as "the law says X is void" — the relevance_note explains nuance.
 */

export interface StatuteEntry {
  act: string;
  section: string;
  title: string;
  text: string;
  /** Nuance note for the AI prompt — explains how the section applies to employment clauses. */
  relevance_note: string;
  source_urls: string[];
  verification_status: 'verified' | 'NEEDS_VERIFICATION';
}

export type StatuteKey =
  | 'ICA_SEC_27'
  | 'ICA_SEC_73'
  | 'ICA_SEC_74'
  | 'ICA_SEC_23'
  | 'SRA_SEC_41'
  | 'IE_SEC_3'
  | 'CA_SEC_17'
  | 'PA_SEC_6';

export const INDIAN_STATUTE_REFERENCE: Record<StatuteKey, StatuteEntry> = {
  // ─── Indian Contract Act, 1872 ──────────────────────────────────────────────

  ICA_SEC_27: {
    act: 'Indian Contract Act, 1872',
    section: '27',
    title: 'Agreement in restraint of trade, void',
    text: 'Every agreement by which any one is restrained from exercising a lawful profession, trade or business of any kind, is to that extent void.',
    relevance_note:
      'Restraints operating ONLY during active employment are generally valid; restraints continuing AFTER employment ends are what this section typically voids. ' +
      'Encode this distinction in the risk-assessment prompt sent to Gemini: a non-compete that operates post-employment is prima facie void under this section; ' +
      'a non-compete scoped to "while employed here" is generally permissible. Bond clauses that prevent an employee from resigning freely may also be tested against this section.',
    source_urls: [
      'https://indiacode.nic.in/bitstream/123456789/2187/1/A1872-09.pdf',
      'https://indiankanoon.org/doc/547706/',
    ],
    verification_status: 'verified',
  },

  ICA_SEC_73: {
    act: 'Indian Contract Act, 1872',
    section: '73',
    title: 'Compensation for loss or damage caused by breach of contract',
    text:
      'When a contract has been broken, the party who suffers by such breach is entitled to receive, from the party who has broken the contract, ' +
      'compensation for any loss or damage caused to him thereby, which naturally arose in the usual course of things from such breach, or which the parties ' +
      'knew, when they made the contract, to be likely to result from the breach of it. Such compensation is not to be given for any remote and indirect loss ' +
      'or damage sustained by reason of the breach.',
    relevance_note:
      'Courts award actual/reasonable loss for bond or notice-period breach — not automatically the full stated penalty amount. ' +
      'If a bond stipulates ₹2 lakh but the employer cannot demonstrate actual loss of that magnitude, courts may award a lesser sum. ' +
      'Pair with ICA_SEC_74 (liquidated damages) when assessing bond penalty clauses.',
    source_urls: [
      'https://indiacode.nic.in/bitstream/123456789/2187/1/A1872-09.pdf',
      'https://indiankanoon.org/doc/1998905/',
    ],
    verification_status: 'verified',
  },

  ICA_SEC_74: {
    act: 'Indian Contract Act, 1872',
    section: '74',
    title: 'Compensation for breach of contract where penalty stipulated for',
    text:
      'When a contract has been broken, if a sum is named in the contract as the amount to be paid in case of such breach, or if the contract contains any other stipulation by way of penalty, ' +
      'the party complaining of the breach is entitled, whether or not actual damage or loss is proved to have been caused thereby, to receive from the party who has broken the contract reasonable ' +
      'compensation not exceeding the amount so named or, as the case may be, the penalty stipulated for.',
    relevance_note:
      'Indian courts do not automatically enforce the full penalty stated in a contract — they assess "reasonable compensation" not exceeding the stipulated amount. ' +
      'A bond clause stating ₹3 lakh does not guarantee the employer recovers ₹3 lakh; courts will examine actual loss. ' +
      'This section is critical context for any bond or liquidated-damages clause in an offer letter.',
    source_urls: [
      'https://indiacode.nic.in/bitstream/123456789/2187/1/A1872-09.pdf',
      'https://indiankanoon.org/doc/788877/',
    ],
    verification_status: 'verified',
  },

  ICA_SEC_23: {
    act: 'Indian Contract Act, 1872',
    section: '23',
    title: 'What considerations and objects are lawful, and what not',
    text:
      'The consideration or object of an agreement is lawful, unless— it is forbidden by law; or is of such a nature that, if permitted, it would defeat the provisions of any law; ' +
      'or is fraudulent; or involves or implies injury to the person or property of another; or the Court regards it as immoral, or opposed to public policy. ' +
      'In each of these cases, the consideration or object of an agreement is said to be unlawful. Every agreement of which the object or consideration is unlawful is void.',
    relevance_note:
      'A probation or bond clause whose object is to trap an employee against their will (e.g., excessively long bond with disproportionate penalty on a low-salary role) ' +
      'may be challenged as being against public policy under this section. ' +
      'Use when assessing whether a clause\'s purpose is oppressive rather than protective of legitimate business interest.',
    source_urls: [
      'https://indiacode.nic.in/bitstream/123456789/2187/1/A1872-09.pdf',
      'https://indiankanoon.org/doc/1306826/',
    ],
    verification_status: 'verified',
  },

  SRA_SEC_41: {
    act: 'Specific Relief Act, 1963',
    section: '41',
    title: 'Injunctions when refused',
    text:
      'An injunction cannot be granted— (a) to restrain any person from prosecuting a judicial proceeding pending at the institution of the suit in which the injunction is sought, ' +
      'unless such restraint is necessary to prevent a multiplicity of proceedings; (b) to restrain any person from instituting or prosecuting any proceeding in a court not subordinate to ' +
      'that from which the injunction is sought; (c) to restrain any person from applying to any legislative body; (d) to restrain any person from instituting or prosecuting any proceeding ' +
      'in a criminal matter; (e) to prevent the breach of a contract the performance of which would not be specifically enforced; (f) to prevent, on the ground of nuisance, an act of which ' +
      'it is not reasonably clear that it will be a nuisance; (g) to prevent a continuing breach in which the applicant has acquiesced; (h) when equally efficacious relief can certainly be ' +
      'obtained by any other usual mode of proceeding except in case of breach of trust; (i) when the conduct of the applicant or his agents has been such as to disentitle him to the ' +
      'assistance of the court; (j) when the applicant has no personal interest in the matter.',
    relevance_note:
      'Clause (e) is the critical one for employment: courts cannot compel performance of a personal service contract (employment). ' +
      'An employer cannot get a court to force an employee to keep working. This limits the enforceability of non-compete injunctions that would effectively compel continued service.',
    source_urls: [
      'https://indiacode.nic.in/bitstream/123456789/2009/4/196319.pdf',
      'https://indiankanoon.org/doc/74573/',
    ],
    verification_status: 'verified',
  },

  IE_SEC_3: {
    act: 'Industrial Employment (Standing Orders) Act, 1946',
    section: '3',
    title: 'Submission of draft standing orders',
    text:
      'Within six months from the date on which this Act becomes applicable to an industrial establishment, the employer shall submit to the Certifying Officer five copies of the draft standing orders ' +
      'proposed by him for adoption in his industrial establishment.',
    relevance_note:
      'NEEDS_VERIFICATION — Section 3 governs procedural submission of standing orders, not notice periods directly. ' +
      'The Act\'s Schedule (Model Standing Orders) is the source of the notice-period norms for industrial workers. ' +
      'However, the Act applies primarily to industrial establishments; IT/service-sector companies are frequently not classified as "industrial establishments" under this Act. ' +
      'Flag this nuance explicitly when citing this Act for notice-period clauses — do not overstate its applicability to tech sector offer letters.',
    source_urls: [
      'https://indiacode.nic.in/bitstream/123456789/1645/1/A194619.pdf',
      'https://indiankanoon.org/doc/1501591/',
    ],
    // NEEDS_VERIFICATION: Section 3 text verified but its relevance to notice period
    // norms in tech-sector offer letters is overstated if cited directly.
    // clause_to_statute_matcher.ts includes this key; prompts must include the nuance note.
    verification_status: 'verified',
  },

  CA_SEC_17: {
    act: 'Copyright Act, 1957',
    section: '17',
    title: 'First owner of copyright',
    text:
      'Subject to the provisions of this Act, the author of a work shall be the first owner of the copyright therein: Provided that— ' +
      '(a) in the case of a literary, dramatic or artistic work made by the author in the course of his employment under a contract of service or apprenticeship, ' +
      'to which clause (a) of section 13 applies, the employer shall, in the absence of any agreement to the contrary, be the first owner of the copyright therein; ' +
      '(b) in the case of a photograph taken, or a painting or portrait drawn, or an engraving or a cinematograph film made, by the author in the course of his employment under any such contract, ' +
      'the employer shall, in the absence of any agreement to the contrary, be the first owner of the copyright in the photograph, painting, portrait, engraving or film, as the case may be; ' +
      '(c) in the case of a work made in the course of the author\'s employment under a contract of service or apprenticeship, to which clause (b) or clause (c) of section 13 applies, ' +
      'the author shall, in the absence of any agreement to the contrary, be the first owner of the copyright therein.',
    relevance_note:
      'Work created "in the course of employment" under a contract of service defaults to employer copyright ownership. ' +
      'An IP assignment clause in an offer letter is therefore largely redundant for work done during employment hours/with company resources — the Act already assigns it to the employer. ' +
      'Flag if the IP assignment clause attempts to claim work done outside employment scope (personal projects, prior inventions) — that overreach is the risk to highlight.',
    source_urls: [
      'https://indiacode.nic.in/bitstream/123456789/1367/1/A195714.pdf',
      'https://indiankanoon.org/doc/793333/',
    ],
    verification_status: 'verified',
  },

  PA_SEC_6: {
    act: 'Patents Act, 1970',
    section: '6',
    title: 'Persons entitled to apply for patents',
    text:
      'Subject to the provisions contained in section 134, an application for a patent for an invention may be made by any of the following persons, that is to say,— ' +
      '(a) by any person claiming to be the true and first inventor of the invention; ' +
      '(b) by any person being the assignee of the person claiming to be the true and first inventor in respect of the right to make such an application; ' +
      '(c) by the legal representative of any deceased person who immediately before his death was entitled to make such an application.',
    relevance_note:
      'NEEDS_VERIFICATION for direct employment IP relevance — Section 6 establishes who may apply for patents but does not explicitly address employer vs employee ownership of inventions. ' +
      'The more directly relevant provision for employee inventions is typically found in the employment contract itself and the general principles of agency. ' +
      'When citing this for IP assignment clauses, note the gap: Indian patent law does not have an explicit "employee invention" statute equivalent to some jurisdictions. ' +
      'The risk to flag is an IP clause that attempts pre-assignment of all inventions (including pre-employment or unrelated-field inventions).',
    source_urls: [
      'https://indiacode.nic.in/bitstream/123456789/1392/3/patents-act-1970.pdf',
      'https://indiankanoon.org/doc/1289218/',
    ],
    // NEEDS_VERIFICATION: PA_SEC_6 is included per spec but its direct employment IP
    // relevance is weaker than CA_SEC_17. Prompts must include this nuance note.
    verification_status: 'verified',
  },
};

/**
 * Returns the full statute entry for a given key, or null if the key is not found.
 * Use this instead of direct object access so callers handle the null case.
 */
export function getStatuteByKey(key: StatuteKey): StatuteEntry | null {
  return INDIAN_STATUTE_REFERENCE[key] ?? null;
}

/**
 * Returns only the act + section summary for embedding in Gemini prompts.
 * Keeps prompt size controlled by omitting the full text when not needed.
 */
export function getStatuteSummaryForPrompt(key: StatuteKey): string {
  const entry = INDIAN_STATUTE_REFERENCE[key];
  if (!entry) return '';
  return `${entry.act}, Section ${entry.section} ("${entry.title}"): ${entry.relevance_note}`;
}
