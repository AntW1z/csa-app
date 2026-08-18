import { StudentYear } from './types';

// Shared copy used in more than one place — currently just the Home launch
// popup and the Profile screen's "What is CSA?" info (Home's own copy is
// slated to move fully into Profile in an upcoming redesign; until then
// both read from here so they can't drift out of sync).
export const WHAT_IS_CSA = `The Georgia Tech Chinese Student Association (CSA) is dedicated to fostering an inclusive environment where individuals of Chinese heritage, Chinese-Americans, and all those interested in Chinese culture can connect and thrive.

By organizing a range of activities, from intimate gatherings to large-scale events, CSA provides opportunities for cultural exchange and community building. We are committed to addressing and discussing issues relevant to Chinese and Chinese-American students, promoting awareness, and encouraging active participation from people of all backgrounds.`;

// Shared by the mandatory post-signup picker (profile.tsx) and the
// check-in-time fallback for legacy accounts missing `year` (PostDetailModal)
// so the two can't drift apart on what the options are.
export const YEAR_OPTIONS: StudentYear[] = ['1', '2', '3', '4', '4+'];
