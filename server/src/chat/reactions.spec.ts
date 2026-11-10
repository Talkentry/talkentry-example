import { applyReactionToggle, isSingleEmoji } from './reactions';

describe('isSingleEmoji', () => {
  it('accepts single emoji, ZWJ sequences, flags, and keycaps', () => {
    for (const value of ['👍', '❤️', '👨‍👩‍👧', '👍🏽', '🇷🇺', '1️⃣']) {
      expect(isSingleEmoji(value)).toBe(true);
    }
  });

  it('rejects text, several emoji, and empty input', () => {
    for (const value of ['', 'a', 'ok', '👍👍', '👍 ', 'x👍']) {
      expect(isSingleEmoji(value)).toBe(false);
    }
  });
});

describe('applyReactionToggle', () => {
  it('adds, replaces, and removes the actor reaction', () => {
    const added = applyReactionToggle([], '👍', 'me');
    expect(added).toEqual([{ emoji: '👍', userIds: ['me'] }]);

    const replaced = applyReactionToggle(
      [
        { emoji: '👍', userIds: ['me', 'peer'] },
        { emoji: '🔥', userIds: ['peer'] },
      ],
      '🔥',
      'me',
    );
    expect(replaced).toEqual([
      { emoji: '👍', userIds: ['peer'] },
      { emoji: '🔥', userIds: ['peer', 'me'] },
    ]);

    expect(applyReactionToggle(added, '👍', 'me')).toEqual([]);
  });
});
