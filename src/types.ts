export type UserRole = 'user' | 'member' | 'moderator' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  memberRequestStatus: 'none' | 'pending';
  requestedAt?: any;
  createdAt: any;
}

export type PostType = 'event' | 'announcement' | 'collab';
export type Visibility = 'everyone' | 'members';

export interface Post {
  id: string;
  type: PostType;
  title: string;
  description: string;
  // ISO 8601 strings from the moderator dashboard's date/time picker — chosen
  // because ISO strings also sort correctly as plain strings, which is what
  // lets Calendar's Firestore query do orderBy('dateTime') directly.
  dateTime?: string;
  endDateTime?: string;
  // True when only dates (not times) were picked — e.g. a multi-day promo
  // running Aug 23-25 with no specific start/end time attached.
  allDay?: boolean;
  locationText?: string;
  visibility: Visibility;
  imageUrl?: string;
  createdBy: string;
  createdAt: any;
}

export interface PopupConfig {
  active: boolean;
  title: string;
  description: string;
  imageUrl?: string;
  ctaText?: string;
  ctaLink?: string;
}

// Shown as an auto-advancing image strip at the top of Home. `link` can be
// an in-app path (e.g. "/calendar") or an external URL.
export interface CarouselItem {
  id: string;
  imageUrl: string;
  link?: string;
  createdAt: any;
}
