// Main Application Entry Point
import { createElement, render, Router, Store } from './framework/index.js';
import { GameWebSocket } from './websocket.js';
import { createNicknamePage } from './pages/nickname-page.js';
import { createWaitingRoom } from './pages/waiting-room.js';
import { createGamePage } from './pages/game-page.js';

// Initialize store
const store = new Store({
  currentPage: 'nickname',
  nickname: '',
  playerId: null,
  players: [],
  gameState: null,
  chatMessages: [],
  countdownTime: null,
  countdownActive: false,
  gameStarted: false
});

// Initialize WebSocket
const ws = new GameWebSocket();

// Initialize router
const router = new Router();

// App state
let cleanupGame = null;

// Setup store reducer
store.setReducer((state, action) => {
  switch (action.type) {
    case 'SET_PAGE':
      return { ...state, currentPage: action.payload };
    
    case 'SET_NICKNAME':
      return { ...state, nickname: action.payload };
    
    case 'SET_PLAYER_ID':
      return { ...state, playerId: action.payload };
    
    case 'SET_PLAYERS':
      return { ...state, players: action.payload };
    
    case 'SET_GAME_STATE':
      return { ...state, gameState: action.payload };
    
    case 'ADD_CHAT_MESSAGE':
      return {
        ...state,
        chatMessages: [...state.chatMessages, action.payload]
      };
    
    case 'SET_COUNTDOWN':
      return {
        ...state,
        countdownTime: action.payload,
        countdownActive: action.payload !== null
      };
    
    case 'SET_GAME_STARTED':
      return { ...state, gameStarted: action.payload };
    
    case 'RESET':
      return {
        currentPage: 'nickname',
        nickname: '',
        playerId: null,
        players: [],
        gameState: null,
        chatMessages: [],
        countdownTime: null,
        countdownActive: false,
        gameStarted: false
      };
    
    default:
      return state;
  }
});

// WebSocket event handlers
ws.on('connected', () => {
  console.log('WebSocket connected');
});

ws.on('game-state', (data) => {
  store.dispatch({ type: 'SET_PLAYERS', payload: data.players || [] });
  store.dispatch({ type: 'SET_GAME_STARTED', payload: data.gameStarted || false });
  
  if (data.countdownActive && data.countdownTime !== null) {
    store.dispatch({ type: 'SET_COUNTDOWN', payload: data.countdownTime });
  }
});

ws.on('player-id', (data) => {
  store.dispatch({ type: 'SET_PLAYER_ID', payload: data.playerId });
  // Only navigate to waiting room after successful join confirmation
  const state = store.getState();
  if (state.currentPage === 'nickname') {
    store.dispatch({ type: 'SET_PAGE', payload: 'waiting' });
    renderApp();
  }
});

ws.on('player-joined', (data) => {
  store.dispatch({ type: 'SET_PLAYERS', payload: data.players || [] });
});

ws.on('player-left', (data) => {
  store.dispatch({ type: 'SET_PLAYERS', payload: data.players || [] });
});

ws.on('chat-message', (data) => {
  store.dispatch({
    type: 'ADD_CHAT_MESSAGE',
    payload: {
      nickname: data.nickname,
      message: data.message,
      timestamp: data.timestamp
    }
  });
});

ws.on('countdown-start', (data) => {
  store.dispatch({ type: 'SET_COUNTDOWN', payload: data.time });
  
  // Update countdown
  const countdownInterval = setInterval(() => {
    const state = store.getState();
    if (state.countdownTime !== null && state.countdownTime > 0) {
      const newTime = Math.max(0, state.countdownTime - 100);
      store.dispatch({ type: 'SET_COUNTDOWN', payload: newTime });
      
      if (newTime === 0) {
        clearInterval(countdownInterval);
      }
    } else {
      clearInterval(countdownInterval);
    }
  }, 100);
});

ws.on('game-start', (data) => {
  store.dispatch({ type: 'SET_GAME_STATE', payload: data.gameState });
  store.dispatch({ type: 'SET_GAME_STARTED', payload: true });
  
  // Ensure we have player ID
  const state = store.getState();
  if (!state.playerId && data.gameState && data.gameState.players) {
    // Find our player by nickname
    const players = Object.keys(data.gameState.players);
    const ourPlayer = players.find(id => {
      const player = data.gameState.players[id];
      return player && player.nickname === state.nickname;
    });
    if (ourPlayer) {
      store.dispatch({ type: 'SET_PLAYER_ID', payload: ourPlayer });
    }
  }
  
  store.dispatch({ type: 'SET_PAGE', payload: 'game' });
  renderApp();
});

ws.on('error', (data) => {
  // Handle server errors (e.g., duplicate nickname, game full, etc.)
  const errorMessage = data.message || 'An error occurred';
  alert(errorMessage);
  
  // If we're on the waiting page due to a failed join, go back to nickname page
  const state = store.getState();
  if (state.currentPage === 'waiting' && !state.playerId) {
    store.dispatch({ type: 'SET_PAGE', payload: 'nickname' });
    renderApp();
  }
});

// Handle nickname submission
function handleJoin(nickname) {
  store.dispatch({ type: 'SET_NICKNAME', payload: nickname });
  
  // Connect WebSocket if not connected
  if (!ws.connected) {
    ws.connect().then(() => {
      ws.send({ type: 'join', nickname: nickname });
      // Don't navigate to waiting room yet - wait for player-id confirmation
    }).catch(error => {
      console.error('Failed to connect:', error);
      alert('Failed to connect to server. Please make sure the server is running.');
    });
  } else {
    ws.send({ type: 'join', nickname: nickname });
    // Don't navigate to waiting room yet - wait for player-id confirmation
  }
  
  // Only navigate to waiting room after successful join (when player-id is received)
  // This is handled in the 'player-id' event handler below
}

// Handle chat message
function handleChatMessage(message) {
  ws.send({ type: 'chat', message: message });
}

// Render function
function renderApp() {
  const state = store.getState();
  const container = document.getElementById('app');

  // Cleanup previous game if exists
  if (cleanupGame) {
    cleanupGame();
    cleanupGame = null;
  }

  let pageElement;

  switch (state.currentPage) {
    case 'nickname':
      pageElement = createNicknamePage(handleJoin);
      break;
    
    case 'waiting':
      pageElement = createWaitingRoom(state, handleChatMessage);
      break;
    
    case 'game':
      if (state.gameState && state.playerId) {
        // Game page is rendered directly, not through framework
        cleanupGame = createGamePage(state.gameState, state.playerId, ws);
        return; // Don't render through framework for game page
      }
      break;
    
    default:
      pageElement = createNicknamePage(handleJoin);
  }

  if (pageElement) {
    render(pageElement, container);
  }
}

// Setup routes
router.addRoute('/', () => {
  store.dispatch({ type: 'SET_PAGE', payload: 'nickname' });
  renderApp();
});

router.addRoute('/waiting', () => {
  if (store.getState().nickname) {
    store.dispatch({ type: 'SET_PAGE', payload: 'waiting' });
    renderApp();
  } else {
    router.navigate('/');
  }
});

router.addRoute('/game', () => {
  if (store.getState().gameStarted) {
    store.dispatch({ type: 'SET_PAGE', payload: 'game' });
    renderApp();
  } else {
    router.navigate('/waiting');
  }
});

// Subscribe to store changes
store.subscribe(() => {
  const state = store.getState();
  if (state.currentPage !== 'game') {
    renderApp();
  }
});

// Initialize app
function init() {
  // Connect to WebSocket
  ws.connect().catch(error => {
    console.error('WebSocket connection failed:', error);
  });

  // Start router
  router.start();

  // Initial render
  renderApp();
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

