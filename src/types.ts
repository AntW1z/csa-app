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
  dateTime?: string;
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
