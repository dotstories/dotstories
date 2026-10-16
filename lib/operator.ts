/**
 * Who runs DotStories: an open-source community project.
 * The site shows only "DotStories"; the Terms and the Privacy Policy name the person (a contract and the GDPR need one).
 */
export const OPERATOR = {
  name: "Dayonel",
  person: "Nestor Plysyuk",
  email: "info@dotstories.com",
} as const;

/** "Dayonel (Nestor Plysyuk)" */
export const OPERATOR_FULL = `${OPERATOR.name} (${OPERATOR.person})`;

/** Last change to the Terms, Privacy and Cookie pages. */
export const LEGAL_UPDATED = "16 October 2026";
