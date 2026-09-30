export type PlatformAdminProfile = { accountType?: unknown; active?: unknown } | undefined;

export function hasPlatformAdminAccess(
  claims: Record<string, unknown>,
  profile: PlatformAdminProfile,
) {
  return claims.email_verified === true
    && profile?.active === true
    && (claims.platformAdmin === true || profile.accountType === 'platform_admin');
}

export function assertAtelierStatusTransition(currentActive: boolean, nextActive: boolean) {
  if (currentActive === nextActive) return false;
  return true;
}
