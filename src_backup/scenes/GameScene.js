import TileSpawner from '../modules/TileSpawner.js';
import InputHandler from '../modules/InputHandler.js';
import WordValidator from '../modules/WordValidator.js';
import ScoreManager from '../modules/ScoreManager.js';
import ChainTracker from '../modules/ChainTracker.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    console.log('GameScene constructor called');
  }

  preload() {
    console.log('GameScene preload called');
    // Placeholder: load assets here (fonts, sounds, etc.)
  }

  create() {
    console.log('GameScene create called');
    
    // Title
    this.titleText = this.add.text(200, 40, 'FALLPHABET', {
      fontFamily: 'Roboto Slab',
      fontSize: '32px',
      color: '#fff',
      fontStyle: 'bold',
      align: 'center',
      stroke: '#000',
      strokeThickness: 4,
    }).setOrigin(0.5, 0.5);

    // Score (top-right)
    this.scoreText = this.add.text(390, 30, '0 pts', {
      fontFamily: 'Roboto Slab',
      fontSize: '20px',
      color: '#fff',
      align: 'right',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(1, 0.5);

    // Chain indicator (below score)
    this.chainText = this.add.text(390, 60, '🔗 x1', {
      fontFamily: 'Roboto Slab',
      fontSize: '18px',
      color: '#fff',
      align: 'right',
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(1, 0.5);

    // Falling grid area (centered)
    this.gridY = 120;
    this.gridHeight = 520;
    this.grid = this.add.rectangle(200, this.gridY + this.gridHeight/2, 320, this.gridHeight, 0xFFF5E1, 0.15);
    this.grid.setStrokeStyle(2, 0x000000); // 2px black border

    // Flash message area (bottom)
    this.flashText = this.add.text(200, 670, '', {
      fontFamily: 'Roboto Slab',
      fontSize: '22px',
      color: '#fff',
      align: 'center',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5, 1);

    // Tap to Play overlay (purple, matches Phaser game config area exactly)
    this.tapToPlayOverlay = this.add.rectangle(
      200, // centerX (config.width / 2)
      350, // centerY (config.height / 2)
      400, // config.width
      700, // config.height
      0x7c3aed,
      0.2
    );
    this.tapToPlayOverlay.setDepth(999); // Just below the playfield border

    // Initialize modules
    console.log('Initializing modules...');
    this.tileSpawner = new TileSpawner(this, this.gridY, this.gridHeight);
    this.inputHandler = new InputHandler(this);
    this.wordValidator = new WordValidator();
    this.scoreManager = new ScoreManager();
    this.chainTracker = new ChainTracker();
    
    // Game state
    this.wordsUsed = 0;
    
    // Listen for word submissions
    this.events.on('wordSubmitted', this.handleWordSubmission, this);
    
    console.log('GameScene create completed');
  }

  update(time, delta) {
    // Update modules
    this.tileSpawner.update(time);
    this.chainTracker.update();
    
    // Update UI
    this.updateUI();
  }
  
  handleWordSubmission(data) {
    const { word, tiles } = data;
    
    // Validate word
    if (!this.wordValidator.validate(word)) {
      this.showFlashMessage(`"${word}" - Invalid word!`, '#ff6b6b');
      return;
    }
    
    // Calculate score
    const chainLevel = this.chainTracker.getChainLevel();
    const score = this.scoreManager.calculateScore(word, chainLevel);
    this.scoreManager.addScore(score);
    this.wordsUsed++;
    
    // Update chain
    this.chainTracker.increaseChain();
    
    // Show feedback
    const chainText = chainLevel > 1 ? ` (x${chainLevel} chain!)` : '';
    this.showFlashMessage(`"${word}" - ${score} pts${chainText}`, '#51cf66');
    
    // Animate tiles
    tiles.forEach(tile => {
      this.tweens.add({
        targets: [tile, tile.text],
        scaleX: 0,
        scaleY: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: () => {
          tile.destroy();
          if (tile.text) tile.text.destroy();
        }
      });
    });
  }
  
  showFlashMessage(message, color = '#fff') {
    this.flashText.setText(message);
    this.flashText.setColor(color);
    
    // Clear message after 2 seconds
    this.time.delayedCall(2000, () => {
      this.flashText.setText('');
    });
  }
  
  updateUI() {
    // Update score
    this.scoreText.setText(`${this.scoreManager.getTotalScore()} pts`);
    
    // Update chain
    const chainLevel = this.chainTracker.getChainLevel();
    this.chainText.setText(`🔗 x${chainLevel}`);
    
    // Chain color based on level
    if (chainLevel > 1) {
      this.chainText.setColor('#ffd700'); // Gold for chains
    } else {
      this.chainText.setColor('#fff');
    }
  }
}
