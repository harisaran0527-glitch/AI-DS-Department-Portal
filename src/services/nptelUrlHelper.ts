/**
 * SWAYAM SSO & NPTEL URL Helper Module
 *
 * Configured Entry Point:
 * SWAYAM SSO Sign-In Endpoint:
 * https://swayam-sso.swayam2.ac.in/signin?response_type=code&client_id=swayam-central-production&redirect_uri=https%3A%2F%2Fswayam.gov.in%2Fmycourses&state={DYNAMIC_STATE}
 *
 * Redirect Target:
 * https://swayam.gov.in/mycourses
 */

export interface StudentYearEmailInfo {
  year?: string;
  email?: string;
  collegeEmail?: string;
}

export function normalizeAcademicYear(year?: string | number | null): string {
  if (!year) return '3rd';
  const str = String(year).trim().toLowerCase();
  if (str.includes('2') || str.includes('ii') || str.includes('second')) return '2nd';
  if (str.includes('3') || str.includes('iii') || str.includes('third')) return '3rd';
  if (str.includes('4') || str.includes('iv') || str.includes('fourth')) return '4th';
  if (str.includes('1') || str.includes('i') || str.includes('first')) return '1st';
  return str;
}

/**
 * Generates a cryptographically unique dynamic state parameter for each SWAYAM SSO OAuth flow
 */
export function generateSwayamState(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return `swayam_${window.crypto.randomUUID()}`;
  }
  return `swayam_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Constructs the official SWAYAM SSO Login URL with dynamic state parameter
 * Endpoint: https://swayam-sso.swayam2.ac.in/signin?response_type=code&client_id=swayam-central-production&redirect_uri=https%3A%2F%2Fswayam.gov.in%2Fmycourses&state={state}
 */
export function getSwayamSsoUrl(customState?: string): string {
  const state = customState || generateSwayamState();
  const baseUrl = 'https://swayam-sso.swayam2.ac.in/signin';
  const redirectUri = 'https://swayam.gov.in/mycourses';
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: 'swayam-central-production',
    redirect_uri: redirectUri,
    state: state
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Returns the SWAYAM SSO URL for student NPTEL authentication
 */
export function getNptelUrlForStudent(_student?: StudentYearEmailInfo | null, customState?: string): { url: string; error?: string } {
  const ssoUrl = getSwayamSsoUrl(customState);
  return { url: ssoUrl };
}
