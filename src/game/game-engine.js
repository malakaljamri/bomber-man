// Game Engine - Core game logic and rendering

export class GameEngine {
  constructor(container, gameState, playerId, ws) {
    this.container = container;
    this.gameState = gameState;
    this.playerId = playerId;
    this.ws = ws;
    this.keys = {};
    this.lastFrameTime = 0;
    this.fps = 60;
    this.frameCount = 0;
    this.lastFpsUpdate = 0;
    this.animationFrameId = null;
    this.gridElement = null;
    this.cellSize = 0;

    this.setupControls();
    this.setupWebSocket();
  }

  setupControls() {
    // Handle both window and container focus
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = true;
      this.handleKeyPress(e);
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Also listen on the container for better focus handling
    if (this.container) {
      this.container.addEventListener('keydown', handleKeyDown);
      this.container.addEventListener('keyup', handleKeyUp);
    }
  }

  handleKeyPress(e) {
    const player = this.gameState.players[this.playerId];
    if (!player || player.lives <= 0) return;

    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      this.placeBomb();
    }
  }

  setupWebSocket() {
    this.ws.on('game-update', (data) => {
      if (data.gameState) {
        // Update game state including map changes (destroyed blocks)
        this.gameState = data.gameState;
        // Update display to reflect any map changes
        this.updateDisplay();
      }
    });

    this.ws.on('player-moved', (data) => {
      // Update other players' positions
      if (this.gameState.players[data.playerId]) {
        this.gameState.players[data.playerId].x = data.x;
        this.gameState.players[data.playerId].y = data.y;
        this.updateDisplay();
      }
    });

    this.ws.on('bomb-placed', (data) => {
      if (data.bomb) {
        // Add bomb to local state if not already there
        if (!this.gameState.bombs) {
          this.gameState.bombs = [];
        }
        const exists = this.gameState.bombs.some(b => b.id === data.bomb.id);
        if (!exists) {
          this.gameState.bombs.push(data.bomb);
        }
        this.updateDisplay();
      }
    });

    this.ws.on('bomb-exploded', (data) => {
      if (data.explosions && data.gameState) {
        // Update game state with new map (destroyed blocks)
        this.gameState = data.gameState;
        // Show explosion flames
        this.showExplosions(data.explosions);
        // Update display to show destroyed blocks are gone
        this.updateDisplay();
      }
    });

    this.ws.on('player-eliminated', (data) => {
      this.updateDisplay();
    });

    this.ws.on('power-up-collected', (data) => {
      if (data.gameState) {
        this.gameState = data.gameState;
        this.updateDisplay();
      }
    });
  }

  start() {
    this.render();
    this.gameLoop();
  }

  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  gameLoop() {
    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    const targetFrameTime = 1000 / this.fps;

    if (deltaTime >= targetFrameTime) {
      this.update(deltaTime);
      this.lastFrameTime = now;
    }

    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  update(deltaTime) {
    const player = this.gameState.players[this.playerId];
    if (!player || player.lives <= 0) return;

    // Grid-based movement - move one cell at a time
    // Base speed: 150ms per cell, faster with speed power-up
    const baseMoveSpeed = 150;
    const moveSpeed = baseMoveSpeed / (player.speed || 1); // Time in ms to move one cell
    const now = performance.now();
    
    // Initialize lastMoveTime if not set
    if (!player.lastMoveTime) {
      player.lastMoveTime = 0; // Allow immediate first movement
    }

    // Check if enough time has passed for next move
    const timeSinceLastMove = now - player.lastMoveTime;
    if (timeSinceLastMove < moveSpeed) {
      return; // Wait before next move
    }

    let newX = player.x;
    let newY = player.y;
    let moved = false;

    // Handle movement - one cell at a time
    // Check for WASD or Arrow keys
    if (this.keys['w'] || this.keys['arrowup']) {
      newY = Math.max(0, player.y - 1);
      moved = true;
    } else if (this.keys['s'] || this.keys['arrowdown']) {
      newY = Math.min(14, player.y + 1);
      moved = true;
    } else if (this.keys['a'] || this.keys['arrowleft']) {
      newX = Math.max(0, player.x - 1);
      moved = true;
    } else if (this.keys['d'] || this.keys['arrowright']) {
      newX = Math.min(14,player.x + 1);
      moved = true;
    }
    
    // Debug: log if any movement keys are pressed (remove after testing)
    // if (Object.keys(this.keys).some(k => this.keys[k] && ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k))) {
    //   // Keys are being detected
    // }

    // Check collision
    if (moved && this.canMoveTo(newX, newY, player.x, player.y)) {
      player.x = newX;
      player.y = newY;
      player.lastMoveTime = now;
      
      // Update display immediately for responsive movement
      this.updateDisplay();
      
      // Send movement to server
      this.ws.send({
        type: 'player-move',
        x: player.x,
        y: player.y
      });

      // Check for power-up collection
      this.checkPowerUpCollection(player.x, player.y);
    } else if (!moved) {
      // Reset move timer if no key is pressed
      player.lastMoveTime = now;
    }

    // Update FPS counter
    this.frameCount++;
    if (now - this.lastFpsUpdate >= 1000) {
      const currentFps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = now;
      // FPS is displayed in game header
    }
  }

  canMoveTo(newX, newY, oldX, oldY) {
    // Grid-based movement, so coordinates are already integers
    if (newX < 0 || newX >= 15 || newY < 0 || newY >= 15) {
      return false;
    }

    const cell = this.gameState.map[newY][newX];
    
    // Can't move into walls or blocks
    if (cell === 1 || cell === 2) {
      return false;
    }

    // Check for bombs
    if (this.gameState.bombs) {
      const bombAtPosition = this.gameState.bombs.some(bomb => 
        Math.floor(bomb.x) === newX && Math.floor(bomb.y) === newY
      );
      if (bombAtPosition) {
        return false;
      }
    }

    return true;
  }

  checkPowerUpCollection(x, y) {
    // Power-up collection is handled on the server
    // This is just for local visual feedback
    // The server will send updates via game-update messages
  }

  placeBomb() {
    const player = this.gameState.players[this.playerId];
    if (!player) return;

    const bombsPlaced = this.gameState.bombs.filter(b => b.playerId === this.playerId).length;
    if (bombsPlaced >= (player.maxBombs || 1)) {
      return; // Can't place more bombs
    }

    const gridX = Math.floor(player.x);
    const gridY = Math.floor(player.y);

    // Check if there's already a bomb here
    const existingBomb = this.gameState.bombs.some(b => 
      Math.floor(b.x) === gridX && Math.floor(b.y) === gridY
    );

    if (existingBomb) return;

    this.ws.send({
      type: 'place-bomb',
      x: gridX,
      y: gridY
    });
  }

  render() {
    this.container.innerHTML = '';
    
    const grid = document.createElement('div');
    grid.className = 'game-grid';
    this.gridElement = grid;

    // Calculate cell size
    const containerWidth = this.container.offsetWidth;
    this.cellSize = containerWidth / 15;

    // Create cells
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < 15; x++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.x = x;
        cell.dataset.y = y;
        cell.style.position = 'relative';

        // Set cell type based on current map state
        this.updateCellType(cell, x, y);

        grid.appendChild(cell);
      }
    }

    this.container.appendChild(grid);
    this.updateDisplay();
  }

  updateCellType(cell, x, y) {
    // Remove all type classes
    cell.classList.remove('wall', 'block');
    
    // Add appropriate type class based on map state
    if (this.gameState.map && this.gameState.map[y] && this.gameState.map[y][x] !== undefined) {
      const cellType = this.gameState.map[y][x];
      if (cellType === 1) {
        cell.classList.add('wall');
      } else if (cellType === 2) {
        cell.classList.add('block');
      }
      // cellType === 0 means empty, no class needed
    }
  }

  updateDisplay() {
    if (!this.gridElement) return;

    // Update cell types based on current map state (for destroyed blocks)
    const cells = this.gridElement.querySelectorAll('.cell');
    cells.forEach(cell => {
      const x = parseInt(cell.dataset.x);
      const y = parseInt(cell.dataset.y);
      this.updateCellType(cell, x, y);
    });

    // Clear previous entities (but keep explosions that are animating)
    cells.forEach(cell => {
      const entities = cell.querySelectorAll('.player, .bomb, .power-up');
      entities.forEach(e => {
        // Don't remove explosion elements that are still animating
        if (!e.classList.contains('explosion')) {
          e.remove();
        }
      });
    });

    // Render power-ups
    if (this.gameState.powerUps) {
      this.gameState.powerUps.forEach(powerUp => {
        const cell = this.gridElement.querySelector(`[data-x="${Math.floor(powerUp.x)}"][data-y="${Math.floor(powerUp.y)}"]`);
        if (cell) {
          const powerUpEl = document.createElement('div');
          powerUpEl.className = `power-up ${powerUp.type}`;
          cell.appendChild(powerUpEl);
        }
      });
    }

    // Render bombs
    if (this.gameState.bombs) {
      this.gameState.bombs.forEach(bomb => {
        const cell = this.gridElement.querySelector(`[data-x="${Math.floor(bomb.x)}"][data-y="${Math.floor(bomb.y)}"]`);
        if (cell) {
          const bombEl = document.createElement('div');
          bombEl.className = 'bomb';
          cell.appendChild(bombEl);
        }
      });
    }

    // Render players
    Object.keys(this.gameState.players).forEach((playerId, index) => {
      const player = this.gameState.players[playerId];
      if (player.lives <= 0) return;

      const cell = this.gridElement.querySelector(`[data-x="${Math.floor(player.x)}"][data-y="${Math.floor(player.y)}"]`);
      if (cell) {
        const playerEl = document.createElement('div');
        playerEl.className = `player player-${(index % 4) + 1}`;
        // Grid-based positioning, no sub-pixel movement needed
        cell.appendChild(playerEl);
      }
    });
  }

  showExplosions(explosions) {
    explosions.forEach(exp => {
      const cell = this.gridElement.querySelector(`[data-x="${exp.x}"][data-y="${exp.y}"]`);
      if (cell) {
        // Create flame element
        const flame = document.createElement('div');
        flame.className = 'explosion';
        flame.style.position = 'absolute';
        flame.style.width = '100%';
        flame.style.height = '100%';
        flame.style.top = '0';
        flame.style.left = '0';
        flame.style.zIndex = '15';
        cell.appendChild(flame);
        
        // Remove flame after animation
        setTimeout(() => {
          if (flame.parentNode) {
            flame.remove();
          }
        }, 500);
      }
    });
    
    // Update display to reflect destroyed blocks
    this.updateDisplay();
  }

  getPlayerInfo() {
    const player = this.gameState.players[this.playerId];
    if (!player) return null;

    return {
      lives: player.lives,
      maxBombs: player.maxBombs || 1,
      explosionRange: player.explosionRange || 1,
      speed: player.speed || 1
    };
  }
}

