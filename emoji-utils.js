// Shared emoji utility functions
class EmojiUtils {
  static extractEmoji(text) {
    // Updated regex to include newer emoji ranges including U+1FAE9 (🫩)
    const emojiRegex = /[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    const match = text.match(emojiRegex);
    return match ? match[0] : null;
  }
  
  static removeEmoji(text) {
    const emoji = this.extractEmoji(text);
    return emoji ? text.replace(emoji, '').trim() : text;
  }
}