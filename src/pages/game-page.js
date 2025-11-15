// Game Page
import { createElement } from '../framework/index.js';
import { GameEngine } from '../game/game-engine.js';

let gameEngine = null;

export function createGamePage(gameState, playerId, ws) {
  const container = document.getElementById('app');
  const gameContainer = document.createElement('div');
  gameContainer.className = 'game-container';
  container.innerHTML = '';
  container.appendChild(gameContainer);

  // Create game header
  const header = document.createElement('div');
  header.className = 'game-header';
  
  const updateHeader = () => {
    if (!gameEngine) return;
    const playerInfo = gameEngine.getPlayerInfo();
    if (!playerInfo) return;

    header.innerHTML = `
      <div class="game-info">
        <div class="info-item">
          <div class="info-label">Lives</div>
          <div class="info-value">${playerInfo.lives}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Bombs</div>
          <div class="info-value">${playerInfo.maxBombs}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Range</div>
          <div class="info-value">${playerInfo.explosionRange}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Speed</div>
          <div class="info-value">${playerInfo.speed.toFixed(1)}</div>
        </div>
      </div>
    `;
  };

  gameContainer.appendChild(header);

  // Create game board container
  const boardContainer = document.createElement('div');
  boardContainer.className = 'game-board';
  boardContainer.tabIndex = 0; // Make it focusable for keyboard events
  boardContainer.style.outline = 'none'; // Remove focus outline
  gameContainer.appendChild(boardContainer);
  
  // Focus the game board so it can receive keyboard events
  setTimeout(() => boardContainer.focus(), 100);

  // Initialize game engine
  gameEngine = new GameEngine(boardContainer, gameState, playerId, ws);
  
  // Update header periodically
  const headerUpdateInterval = setInterval(updateHeader, 100);
  updateHeader();

  // Start game loop
  gameEngine.start();

  // Cleanup function
  return () => {
    if (gameEngine) {
      gameEngine.stop();
      gameEngine = null;
    }
    clearInterval(headerUpdateInterval);
  };
}

