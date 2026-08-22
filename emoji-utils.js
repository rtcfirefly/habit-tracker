// Shared emoji utility functions

// Extended_Pictographic covers every pictographic emoji, including recent
// additions like 🫩, without the false positives of \p{Emoji} - which also
// matches bare digits, '#' and '*'. Those three only count as emoji inside a
// keycap sequence, and flags are pairs of regional indicators, so both are
// matched separately.
const EMOJI_SEQUENCE_REGEX = new RegExp([
  '\\p{Regional_Indicator}{2}',
  '[0-9#*]\\uFE0F?\\u20E3',
  '\\p{Extended_Pictographic}(?:\\uFE0F|\\p{Emoji_Modifier})?' +
    '(?:\\u200D\\p{Extended_Pictographic}(?:\\uFE0F|\\p{Emoji_Modifier})?)*'
].join('|'), 'u');

class EmojiUtils {
  static extractEmoji(text) {
    if (typeof text !== 'string') {
      return null;
    }

    const match = text.match(EMOJI_SEQUENCE_REGEX);
    return match ? match[0] : null;
  }

  static removeEmoji(text) {
    const emoji = this.extractEmoji(text);
    return emoji ? text.replace(emoji, '').trim() : text;
  }
}
