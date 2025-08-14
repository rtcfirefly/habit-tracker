// Shared emoji utility functions
class EmojiUtils {
  static extractEmoji(text) {
    // Comprehensive emoji matching that explicitly includes all ranges
    // Including newer emojis like 🫩 (U+1FAE9)
    
    // First, try the simple emoji property match with explicit ranges for newer emojis
    const simpleEmojiRegex = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    
    // Check if text starts with a simple emoji
    const simpleMatch = text.match(simpleEmojiRegex);
    if (simpleMatch) {
      // Now check if this is part of a larger sequence
      const complexEmojiRegex = new RegExp(
        '^[\\u{1F300}-\\u{1F5FF}\\u{1F600}-\\u{1F64F}\\u{1F680}-\\u{1F6FF}\\u{1F700}-\\u{1F77F}\\u{1F780}-\\u{1F7FF}\\u{1F800}-\\u{1F8FF}\\u{1F900}-\\u{1F9FF}\\u{1FA00}-\\u{1FA6F}\\u{1FA70}-\\u{1FAFF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}]' +
        '(?:[\\u{1F3FB}-\\u{1F3FF}])?' + // Skin tone modifier
        '(?:\\u200D[\\u{1F300}-\\u{1F5FF}\\u{1F600}-\\u{1F64F}\\u{1F680}-\\u{1F6FF}\\u{1F700}-\\u{1F77F}\\u{1F780}-\\u{1F7FF}\\u{1F800}-\\u{1F8FF}\\u{1F900}-\\u{1F9FF}\\u{1FA00}-\\u{1FA6F}\\u{1FA70}-\\u{1FAFF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}\\u{2640}\\u{2642}\\u{2695}\\u{2696}\\u{2708}](?:[\\u{1F3FB}-\\u{1F3FF}])?)*' + // ZWJ sequences
        '(?:\\uFE0F)?', // Variation selector
        'u'
      );
      
      const complexMatch = text.match(complexEmojiRegex);
      if (complexMatch) {
        return complexMatch[0];
      }
      
      // If no complex match, return the simple emoji
      return simpleMatch[0];
    }
    
    return null;
  }
  
  static removeEmoji(text) {
    const emoji = this.extractEmoji(text);
    return emoji ? text.replace(emoji, '').trim() : text;
  }
}