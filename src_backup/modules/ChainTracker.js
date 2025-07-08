export default class ChainTracker {
  constructor() {
    this.chainLevel = 1;
    this.maxChainLevel = 1;
    this.lastWordTime = 0;
    this.chainTimeout = 3000; // milliseconds to maintain chain
    this.missedTilesThreshold = 5; // tiles that can fall before chain breaks
    this.missedTilesCount = 0;
  }

  getChainLevel() {
    return this.chainLevel;
  }
  
  getMaxChainLevel() {
    return this.maxChainLevel;
  }

  increaseChain() {
    this.chainLevel++;
    if (this.chainLevel > this.maxChainLevel) {
      this.maxChainLevel = this.chainLevel;
    }
    this.lastWordTime = Date.now();
    this.missedTilesCount = 0;
  }

  resetChain() {
    this.chainLevel = 1;
    this.missedTilesCount = 0;
  }
  
  addMissedTile() {
    this.missedTilesCount++;
    if (this.missedTilesCount >= this.missedTilesThreshold) {
      this.resetChain();
    }
  }
  
  update() {
    // Check if chain should reset due to time
    if (this.chainLevel > 1 && Date.now() - this.lastWordTime > this.chainTimeout) {
      this.resetChain();
    }
  }
  
  shouldResetChain() {
    return this.missedTilesCount >= this.missedTilesThreshold || 
           (this.chainLevel > 1 && Date.now() - this.lastWordTime > this.chainTimeout);
  }
}
