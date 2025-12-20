// Game Page
import { createElement } from '../framework/index.js';
import { GameEngine } from '../game/game-engine.js';

let gameEngine = null;

export function createGamePage(gameState, playerId, ws, onChatMessage, chatMessages) {
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
        <div class="info-item">
          <div class="info-label">FPS</div>
          <div class="info-value ${playerInfo.fps >= 60 ? 'fps-good' : 'fps-low'}">${playerInfo.fps}</div>
        </div>
      </div>
    `;
  };

  gameContainer.appendChild(header);

  // Create main game area with board and chat
  const mainGameArea = document.createElement('div');
  mainGameArea.className = 'main-game-area';
  
  // Create game board container
  const boardContainer = document.createElement('div');
  boardContainer.className = 'game-board';
  boardContainer.tabIndex = 0; // Make it focusable for keyboard events
  boardContainer.style.outline = 'none'; // Remove focus outline
  mainGameArea.appendChild(boardContainer);
  
  // Create chat section for game
  const chatSection = document.createElement('div');
  chatSection.className = 'game-chat-section';
  
  const updateChatMessages = () => {
    // Get latest chat messages from store
    const state = window.store?.getState();
    const currentChatMessages = state?.chatMessages || [];
    
    const messagesHtml = currentChatMessages.map(msg => `
      <div class="chat-message">
        <span class="nickname">${msg.nickname}: </span>
        <span>${msg.message}</span>
      </div>
    `).join('');
    
    chatSection.innerHTML = `
      <div class="game-chat-header">Chat</div>
      <div class="game-chat-messages">
        ${messagesHtml}
      </div>
      <form class="game-chat-input-container">
        <input type="text" class="game-chat-input" placeholder="Type a message..." maxLength="20">
        <button type="submit" class="game-chat-send">Send</button>
      </form>
    `;
    
    // Add event listeners to the new form
    const form = chatSection.querySelector('.game-chat-input-container');
    const input = chatSection.querySelector('.game-chat-input');
    
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const message = input.value.trim();
      if (message && message.length <= 20) {
        onChatMessage(message);
        input.value = '';
      }
    });
    
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const message = input.value.trim();
        if (message && message.length <= 20) {
          onChatMessage(message);
          input.value = '';
        }
      }
    });
    
    // Auto-scroll to bottom
    const messagesContainer = chatSection.querySelector('.game-chat-messages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };
  
  updateChatMessages();
  mainGameArea.appendChild(chatSection);
  gameContainer.appendChild(mainGameArea);
  
  // Focus the game board so it can receive keyboard events
  // Use multiple attempts to ensure focus is set
  setTimeout(() => {
    boardContainer.focus();
    // Also try clicking to ensure focus
    boardContainer.click();
  }, 100);
  
  // Re-focus when clicking on the game board
  boardContainer.addEventListener('click', () => {
    boardContainer.focus();
  });

  // Initialize game engine
  console.log('GamePage: Initializing game engine...');
  console.log('GamePage: Container:', boardContainer);
  console.log('GamePage: GameState:', gameState);
  console.log('GamePage: PlayerId:', playerId);
  console.log('GamePage: SelectedCharacter:', window.store.getState().selectedCharacter);
  
  let headerUpdateInterval = null;
  
  try {
    gameEngine = new GameEngine(boardContainer, gameState, playerId, ws, window.store.getState().selectedCharacter);
    
    // Update header periodically
    headerUpdateInterval = setInterval(updateHeader, 100);
    updateHeader();

    // Start game loop
    gameEngine.start();
    console.log('GamePage: Game engine started successfully');
  } catch (error) {
    console.error('GamePage: Error initializing game engine:', error);
  }

  // Return cleanup function and chat update function
  const cleanup = () => {
    if (gameEngine) {
      gameEngine.stop();
      gameEngine = null;
    }
    if (headerUpdateInterval) {
      clearInterval(headerUpdateInterval);
    }
  };
  
  // Store update function for external access
  cleanup.updateChat = updateChatMessages;
  
  return cleanup;
}

