// Game Engine - Core game logic and rendering

export class GameEngine {
  constructor(container, gameState, playerId, ws, selectedCharacter = null) {
    console.log('GameEngine: Constructor called with:', { container, gameState, playerId, ws, selectedCharacter });
    
    // Validate required parameters
    if (!container) {
      throw new Error('GameEngine: Container is required');
    }
    if (!gameState) {
      throw new Error('GameEngine: GameState is required');
    }
    if (!playerId) {
      throw new Error('GameEngine: PlayerId is required');
    }
    if (!ws) {
      throw new Error('GameEngine: WebSocket is required');
    }
    
    this.container = container;
    this.gameState = gameState;
    this.playerId = playerId;
    this.ws = ws;
    this.selectedCharacter = selectedCharacter;
    this.keys = {};
    this.lastFrameTime = 0;
    this.fps = 60;
    this.frameCount = 0;
    this.lastFpsUpdate = 0;
    this.currentFps = 60;
    this.animationFrameId = null;
    this.gridElement = null;
    this.cellSize = 0;
    this.cellCache = {}; // Cache cell references for faster access
    this.entityCache = {}; // Cache entity elements to avoid recreation
    this.lastDisplayUpdate = 0;
    this.displayUpdateThrottle = 16; // Update display max once per frame (60fps)

    this.setupControls();
    this.setupWebSocket();
  }

  checkGameOver() {
    if (!this.gameState.players) return;
    
    // Count alive players
    const alivePlayers = Object.keys(this.gameState.players).filter(playerId => {
      const player = this.gameState.players[playerId];
      return player && player.lives > 0;
    });
    
    // Remove dead players from the game completely
    this.removeDeadPlayers();
    
    // If only one player is alive, declare winner
    if (alivePlayers.length === 1) {
      const winnerId = alivePlayers[0];
      const winner = this.gameState.players[winnerId];
      this.showGameOver(winner);
    }
  }

  removeDeadPlayers() {
    if (!this.gameState.players) return;
    
    // Remove players with 0 or negative lives from the game state
    Object.keys(this.gameState.players).forEach(playerId => {
      const player = this.gameState.players[playerId];
      if (player && player.lives <= 0) {
        console.log(`Removing dead player: ${player.nickname || playerId}`);
        delete this.gameState.players[playerId];
      }
    });
  }

  showGameOver(winner) {
    // Stop the game
    this.stop();
    
    // Create game over overlay
    const gameOverDiv = document.createElement('div');
    gameOverDiv.className = 'game-over';
    gameOverDiv.innerHTML = `
      <div class="game-over-content">
        <h2>🎉 Game Over! 🎉</h2>
        <p style="font-size: 1.5em; margin: 20px 0;">
          <strong>Winner: ${winner.nickname || 'Unknown Player'}</strong>
        </p>
        <p style="font-size: 1.2em; color: #666; margin-bottom: 30px;">
          Congratulations! You are the last survivor!
        </p>
        <button onclick="location.reload()" style="
          padding: 15px 30px;
          font-size: 1.2em;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          transition: background 0.3s;
        " onmouseover="this.style.background='#5a6fd8'" onmouseout="this.style.background='#667eea'">
          Play Again
        </button>
      </div>
    `;
    
    // Add to container
    this.container.appendChild(gameOverDiv);
    
    console.log(`Game Over! Winner: ${winner.nickname}`);
  }

  setupControls() {
    // Normalize key names for consistent handling
    const normalizeKey = (key) => {
      const keyMap = {
        'ArrowUp': 'arrowup',
        'ArrowDown': 'arrowdown',
        'ArrowLeft': 'arrowleft',
        'ArrowRight': 'arrowright',
        ' ': 'space'
      };
      return keyMap[key] || key.toLowerCase();
    };

    // Handle both window and container focus
    const handleKeyDown = (e) => {
      // Skip processing if user is typing in an input field
      const target = e.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }
      
      // Prevent default for game controls to avoid scrolling
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'a', 's', 'd'].includes(e.key)) {
        e.preventDefault();
      }
      
      const key = normalizeKey(e.key);
      this.keys[key] = true;
      this.handleKeyPress(e);
    };

    const handleKeyUp = (e) => {
      // Skip processing if user is typing in an input field
      const target = e.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }
      
      const key = normalizeKey(e.key);
      this.keys[key] = false;
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp, { passive: false });
    
    // Also listen on the container for better focus handling
    if (this.container) {
      this.container.addEventListener('keydown', handleKeyDown, { passive: false });
      this.container.addEventListener('keyup', handleKeyUp, { passive: false });
      // Ensure container can receive focus
      this.container.setAttribute('tabindex', '0');
    }
  }

  handleKeyPress(e) {
    const player = this.gameState.players[this.playerId];
    if (!player || player.lives <= 0) return;

    const normalizedKey = e.key === ' ' ? 'space' : e.key.toLowerCase();
    if (normalizedKey === 'space' || e.key === 'Spacebar') {
      e.preventDefault();
      this.placeBomb();
    }
  }

  setupWebSocket() {
    this.ws.on('game-update', (data) => {
      if (data.gameState) {
        // Check if map changed (blocks destroyed)
        const mapChanged = JSON.stringify(this.gameState.map) !== JSON.stringify(data.gameState.map);
        // Update game state including map changes (destroyed blocks)
        this.gameState = data.gameState;
        // Update cell types if map changed
        if (mapChanged && this.gameState.map) {
          for (let y = 0; y < 15; y++) {
            for (let x = 0; x < 15; x++) {
              const cell = this.cellCache[`${x},${y}`];
              if (cell) {
                this.updateCellType(cell, x, y);
              }
            }
          }
        }
        // Update display to reflect any changes
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
        // Check if map changed (blocks destroyed)
        const mapChanged = JSON.stringify(this.gameState.map) !== JSON.stringify(data.gameState.map);
        // Update game state with new map (destroyed blocks)
        this.gameState = data.gameState;
        // Update cell types if map changed
        if (mapChanged && this.gameState.map) {
          for (let y = 0; y < 15; y++) {
            for (let x = 0; x < 15; x++) {
              const cell = this.cellCache[`${x},${y}`];
              if (cell) {
                this.updateCellType(cell, x, y);
              }
            }
          }
        }
        // Show explosion flames
        this.showExplosions(data.explosions);
        // Update display to show destroyed blocks are gone
        this.updateDisplay();
        // Check for game over after bomb explosion (players may have died)
        this.checkGameOver();
      }
    });

    this.ws.on('player-eliminated', (data) => {
      console.log('Player eliminated:', data);
      this.updateDisplay();
      // Check for game over after player elimination
      this.checkGameOver();
    });

    this.ws.on('power-up-collected', (data) => {
      if (data.gameState) {
        this.gameState = data.gameState;
        this.updateDisplay();
      }
    });
  }

  start() {
    console.log('GameEngine: Starting game...');
    try {
      this.render();
      this.gameLoop();
      console.log('GameEngine: Game started successfully');
    } catch (error) {
      console.error('GameEngine: Error starting game:', error);
    }
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

    // Count all RAF calls for accurate FPS measurement (matches Chrome's FPS meter)
    this.frameCount++;

    if (deltaTime >= targetFrameTime) {
      this.update(deltaTime);
      this.lastFrameTime = now;
    }

    // Update FPS counter every second
    if (now - this.lastFpsUpdate >= 1000) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  update(deltaTime) {
    if (!this.gameState || !this.gameState.players || !this.playerId) {
      console.warn('GameEngine: Missing gameState, players, or playerId');
      return;
    }
    
    // Check for game over condition
    this.checkGameOver();
    
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
      
      // Update display for responsive movement (throttled internally)
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
    console.log('GameEngine: Starting render...');
    console.log('GameEngine: Container:', this.container);
    console.log('GameEngine: GameState:', this.gameState);
    console.log('GameEngine: PlayerId:', this.playerId);
    
    this.container.innerHTML = '';
    
    const grid = document.createElement('div');
    grid.className = 'game-grid';
    this.gridElement = grid;
    this.cellCache = {}; // Reset cell cache
    this.entityCache = {}; // Reset entity cache

    // Calculate cell size
    const containerWidth = this.container.offsetWidth;
    this.cellSize = containerWidth / 15;

    // Create cells and cache them
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
        // Cache cell reference for fast lookup
        this.cellCache[`${x},${y}`] = cell;
      }
    }

    this.container.appendChild(grid);
    this.updateDisplay();
    console.log('GameEngine: Render completed');
  }

  updateCellType(cell, x, y) {
    // Remove all type classes
    cell.classList.remove('wall', 'block');
    
    // Add appropriate type class based on map state
    if (this.gameState && this.gameState.map && this.gameState.map[y] && this.gameState.map[y][x] !== undefined) {
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

    // Throttle display updates to max 60fps
    const now = performance.now();
    if (now - this.lastDisplayUpdate < this.displayUpdateThrottle) {
      return;
    }
    this.lastDisplayUpdate = now;

    // Remove dead players before updating display
    this.removeDeadPlayers();

    // Track which cells need entity updates
    const cellsWithEntities = new Set();

    // Clear previous entities (but keep explosions that are animating)
    Object.keys(this.entityCache).forEach(key => {
      const entity = this.entityCache[key];
      if (entity && entity.parentNode) {
        // Don't remove explosion elements that are still animating
        if (!entity.classList.contains('explosion')) {
          entity.remove();
        }
      }
      delete this.entityCache[key];
    });

    // Render power-ups
    if (this.gameState.powerUps) {
      this.gameState.powerUps.forEach(powerUp => {
        const x = Math.floor(powerUp.x);
        const y = Math.floor(powerUp.y);
        const cell = this.cellCache[`${x},${y}`];
        if (cell) {
          const powerUpEl = document.createElement('div');
          powerUpEl.className = `power-up ${powerUp.type}`;
          cell.appendChild(powerUpEl);
          this.entityCache[`powerup-${powerUp.id}`] = powerUpEl;
          cellsWithEntities.add(`${x},${y}`);
        }
      });
    }

    // Render bombs
    if (this.gameState.bombs) {
      this.gameState.bombs.forEach(bomb => {
        const x = Math.floor(bomb.x);
        const y = Math.floor(bomb.y);
        const cell = this.cellCache[`${x},${y}`];
        if (cell) {
          const bombEl = document.createElement('div');
          bombEl.className = 'bomb';
          cell.appendChild(bombEl);
          this.entityCache[`bomb-${bomb.id}`] = bombEl;
          cellsWithEntities.add(`${x},${y}`);
        }
      });
    }

    // Render players
    Object.keys(this.gameState.players).forEach((playerId, index) => {
      const player = this.gameState.players[playerId];
      if (player.lives <= 0) return;

      const x = Math.floor(player.x);
      const y = Math.floor(player.y);
      const cell = this.cellCache[`${x},${y}`];
      if (cell) {
        const playerEl = document.createElement('div');
        playerEl.className = 'player';
        
        // Add character image if available
        if (player.character && player.character.image) {
          const charImg = document.createElement('img');
          charImg.src = player.character.image;
          charImg.alt = player.character.name || 'Character';
          charImg.className = 'character-sprite';
          playerEl.appendChild(charImg);
        } else {
          // Fallback to generic player class
          playerEl.className += ` player-${(index % 4) + 1}`;
        }
        
        // Add player name label
        const nameLabel = document.createElement('div');
        nameLabel.className = 'player-name';
        nameLabel.textContent = player.nickname || `Player ${index + 1}`;
        playerEl.appendChild(nameLabel);
        
        // Add player lives label
        const livesLabel = document.createElement('div');
        livesLabel.className = 'player-lives';
        livesLabel.textContent = `❤️ ${player.lives}`;
        playerEl.appendChild(livesLabel);
        
        cell.appendChild(playerEl);
        this.entityCache[`player-${playerId}`] = playerEl;
        cellsWithEntities.add(`${x},${y}`);
      }
    });

    // Only update cell types when map changes (destroyed blocks)
    // We track this via map reference changes from WebSocket updates
    // Cell types are set during initial render and only need updates when blocks are destroyed
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
      speed: player.speed || 1,
      fps: this.currentFps
    };
  }
}

