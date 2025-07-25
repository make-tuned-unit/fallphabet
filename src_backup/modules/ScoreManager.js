export default class ScoreManager {
  constructor() {
    this.totalScore = 0;
    
    // Scrabble-style letter values
    this.letterValues = {
      'A': 1, 'B': 3, 'C': 3, 'D': 2, 'E': 1, 'F': 4, 'G': 2, 'H': 4, 'I': 1,
      'J': 8, 'K': 5, 'L': 1, 'M': 3, 'N': 1, 'O': 1, 'P': 3, 'Q': 10, 'R': 1,
      'S': 1, 'T': 1, 'U': 1, 'V': 4, 'W': 4, 'X': 8, 'Y': 4, 'Z': 10
    };
  }

  calculateScore(word, chainMultiplier = 1) {
    let score = 0;
    
    // Calculate base score from letter values
    for (const letter of word.toUpperCase()) {
      score += this.letterValues[letter] || 0;
    }
    
    // Apply chain multiplier
    score *= chainMultiplier;
    
    return score;
  }
  
  addScore(score) {
    this.totalScore += score;
    return this.totalScore;
  }
  
  getTotalScore() {
    return this.totalScore;
  }
  
  resetScore() {
    this.totalScore = 0;
  }
}
