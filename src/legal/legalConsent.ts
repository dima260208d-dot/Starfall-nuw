/** Bump when legal texts change — users must re-accept. */
export const LEGAL_DOCS_VERSION = 1;

const LS_KEY = "starfall_legal_consent_v1";

export type LegalDocId =
  | "userAgreement"
  | "privacyPolicy"
  | "personalDataConsent"
  | "ageConfirmation";

export type LegalConsentRecord = {
  version: number;
  acceptedAt: string;
  docs: LegalDocId[];
};

export function hasLegalConsent(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as LegalConsentRecord;
    return data.version === LEGAL_DOCS_VERSION && data.docs.length >= 4;
  } catch {
    return false;
  }
}

export function saveLegalConsent(docs: LegalDocId[]): void {
  const record: LegalConsentRecord = {
    version: LEGAL_DOCS_VERSION,
    acceptedAt: new Date().toISOString(),
    docs,
  };
  localStorage.setItem(LS_KEY, JSON.stringify(record));
}
