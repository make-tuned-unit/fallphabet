export default class TileSpawner {
  constructor(scene, gridY, gridHeight) {
    this.scene = scene;
    this.gridY = gridY;
    this.gridHeight = gridHeight;
    this.columns = 4;
    this.columnWidth = 80;
    this.spawnInterval = 1500; // milliseconds
    this.lastSpawnTime = 0;
    
    // Letter frequency (Scrabble-style distribution)
    this.letters = {
      'E': 12, 'A': 9, 'I': 9, 'N': 6, 'O': 8, 'R': 6, 'T': 6, 'L': 4, 'S': 4, 'U': 4,
      'D': 4, 'P': 2, 'M': 2, 'H': 2, 'G': 3, 'B': 2, 'F': 2, 'Y': 2, 'W': 2, 'K': 1,
      'V': 2, 'X': 1, 'Z': 1, 'J': 1, 'Q': 1
    };
    
    this.letterPool = [];
    this.buildLetterPool();
    
    // Create tile group
    this.tiles = this.scene.physics.add.group();
    
    // Column positions
    this.columnPositions = [];
    for (let i = 0; i < this.columns; i++) {
      this.columnPositions.push(60 + (i * this.columnWidth));
    }
  }
  
  buildLetterPool() {
    for (const [letter, frequency] of Object.entries(this.letters)) {
      for (let i = 0; i < frequency; i++) {
        this.letterPool.push(letter);
      }
    }
  }
  
  getRandomLetter() {
    const index = Math.floor(Math.random() * this.letterPool.length);
    return this.letterPool[index];
  }
  
  spawnTile(column) {
    const letter = this.getRandomLetter();
    const x = this.columnPositions[column];
    const y = this.gridY - 50; // Start above the grid
    
    // Create tile as a rectangle with text
    const tile = this.scene.add.rectangle(x, y, 60, 60, 0xFFF5E1);
    tile.setStrokeStyle(2, 0x000000);
    tile.setInteractive();
    
    // Add letter text
    const text = this.scene.add.text(x, y, letter, {
      fontFamily: 'Roboto Slab',
      fontSize: '24px',
      color: '#000',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    // Store letter data
    tile.letter = letter;
    tile.text = text;
    tile.column = column;
    
    // Add physics
    this.scene.physics.add.existing(tile);
    tile.body.setVelocityY(100);
    
    // Add to group
    this.tiles.add(tile);
    
    // Add bounce animation
    this.scene.tweens.add({
      targets: tile,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 100,
      yoyo: true,
      ease: 'Power2'
    });
    
    return tile;
  }
  
  update(time) {
    // Spawn new tiles at intervals
    if (time > this.lastSpawnTime + this.spawnInterval) {
      const randomColumn = Math.floor(Math.random() * this.columns);
      this.spawnTile(randomColumn);
      this.lastSpawnTime = time;
    }
    
    // Remove tiles that fall below the grid
    this.tiles.children.entries.forEach(tile => {
      if (tile.y > this.gridY + this.gridHeight + 100) {
        tile.destroy();
        if (tile.text) tile.text.destroy();
      }
    });
  }
  
  getTilesInColumn(column) {
    return this.tiles.children.entries.filter(tile => 
      tile.column === column && 
      tile.y >= this.gridY && 
      tile.y <= this.gridY + this.gridHeight
    );
  }
}
