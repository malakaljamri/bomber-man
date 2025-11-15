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
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      this.handleKeyPress(e);
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });
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
        this.gameState = data.gameState;
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
        this.gameState = data.gameState;
        this.showExplosions(data.explosions);
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
    // Base speed: 200ms per cell, faster with speed power-up
    const baseMoveSpeed = 200;
    const moveSpeed = baseMoveSpeed / (player.speed || 1); // Time in ms to move one cell
    const now = performance.now();
    
    if (!player.lastMoveTime) {
      player.lastMoveTime = now;
    }

    // Check if enough time has passed for next move
    if (now - player.lastMoveTime < moveSpeed) {
      return; // Wait before next move
    }

    let newX = player.x;
    let newY = player.y;
    let moved = false;

    // Handle movement - one cell at a time
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
      newX = Math.min(14, player.x + 1);
      moved = true;
    }

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

        const cellType = this.gameState.map[y][x];
        if (cellType === 1) {
          cell.classList.add('wall');
        } else if (cellType === 2) {
          cell.classList.add('block');
        }

        grid.appendChild(cell);
      }
    }

    this.container.appendChild(grid);
    this.updateDisplay();
  }

  updateDisplay() {
    if (!this.gridElement) return;

    // Clear previous entities
    const cells = this.gridElement.querySelectorAll('.cell');
    cells.forEach(cell => {
      // Remove entity classes but keep cell type classes
      cell.classList.remove('explosion');
      const entities = cell.querySelectorAll('.player, .bomb, .power-up');
      entities.forEach(e => e.remove());
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
        cell.classList.add('explosion');
        setTimeout(() => {
          cell.classList.remove('explosion');
        }, 300);
      }
    });
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

