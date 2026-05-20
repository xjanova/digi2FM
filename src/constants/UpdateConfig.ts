const GITHUB_OWNER = 'xjanova';
const GITHUB_REPO = 'digi2FM';

export const UpdateConfig = {
  GITHUB_OWNER,
  GITHUB_REPO,
  // Latest published (non-draft, non-prerelease) release.
  RELEASES_API: `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
  // Human-facing release page, used as a fallback when no APK asset is found.
  RELEASES_PAGE: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
} as const;
