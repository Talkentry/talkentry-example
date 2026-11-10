import type { ReactionDto } from './chat.types';

const MAX_REACTION_LENGTH = 32;
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const EMOJI_MARK = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u;

/** One emoji grapheme: pictograph, ZWJ sequence, flag, or keycap. Plain text is rejected. */
export const isSingleEmoji = (value: string): boolean => {
  if (!value || value.length > MAX_REACTION_LENGTH) return false;
  if (!EMOJI_MARK.test(value)) return false;
  return [...graphemes.segment(value)].length === 1;
};

/**
 * One reaction per actor. The same emoji again removes it; a different one replaces it.
 */
export const applyReactionToggle = (
  reactions: readonly ReactionDto[],
  emoji: string,
  actorId: string,
): ReactionDto[] => {
  const removesOwn = reactions.some(
    (item) => item.emoji === emoji && item.userIds.includes(actorId),
  );
  const next = reactions
    .map((item) => ({
      emoji: item.emoji,
      userIds: item.userIds.filter((id) => id !== actorId),
    }))
    .filter((item) => item.userIds.length > 0);

  if (removesOwn) return next;

  const group = next.find((item) => item.emoji === emoji);
  if (group) {
    group.userIds.push(actorId);
  } else {
    next.push({ emoji, userIds: [actorId] });
  }
  return next;
};
