import Constants from 'expo-constants';

import { getBuildGitSha, getBuildGitShaShort } from '../buildInfo';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        buildGitSha: 'dd979bfd9aea620d459c865f036c89483cfe8712',
      },
    },
  },
}));

describe('buildInfo', () => {
  it('reads full SHA from expo config extra', () => {
    expect(getBuildGitSha()).toBe('dd979bfd9aea620d459c865f036c89483cfe8712');
  });

  it('shortens SHA to 7 characters for display', () => {
    expect(getBuildGitShaShort()).toBe('dd979bf');
  });
});
