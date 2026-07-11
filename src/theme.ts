// Shared design tokens. Red is the primary accent (buttons, active tab,
// event tags); gold/amber is secondary and used sparingly (collab tags).
// Every screen should pull from here instead of hardcoding colors.
export const colors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#FAFAFA',
  border: '#EEEEEE',
  borderStrong: '#E2E2E2',

  textPrimary: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textMuted: '#9B9B9B',
  onAccent: '#FFFFFF',

  red: '#A32D2D',
  redDark: '#7A1F1F',
  redSoft: '#FBEAEA',
  redSoftText: '#7A1F1F',

  amber: '#B8860B',
  amberSoft: '#FBF1DC',
  amberSoftText: '#8A6108',

  neutralSoft: '#F1F1F1',
  neutralSoftText: '#5A5A5A',

  success: '#EAF3DE',
  successText: '#27500A',
  danger: '#FCEBEB',
  dangerText: '#791F1F',

  overlay: 'rgba(0,0,0,0.5)',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
};

export const tagStyle: Record<'event' | 'announcement' | 'collab', { bg: string; text: string }> = {
  event: { bg: colors.redSoft, text: colors.redSoftText },
  collab: { bg: colors.amberSoft, text: colors.amberSoftText },
  announcement: { bg: colors.neutralSoft, text: colors.neutralSoftText },
};
