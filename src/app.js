// Main Application Entry Point
import { createElement, render, Router, Store } from './framework/index.js';
import { GameWebSocket } from './websocket.js';
import { createNicknamePage } from './pages/nickname-page.js';
import { createWaitingRoom } from './pages/waiting-room.js';
import { createGamePage } from './pages/game-page.js';

// Generate unique tab ID to prevent cross-tab interference
const tabId = 'tab-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
sessionStorage.setItem('bomberman-tab-id', tabId);

// Initialize store
const store = new Store({
  currentPage: 'nickname',
  nickname: '',
  playerId: null,
  tabId: tabId, // Add tab isolation
  players: [],
  gameState: null,
  chatMessages: [],
  countdownTime: null,
  countdownActive: false,
  gameStarted: false,
  selectedCharacter: null
});

// Make store globally accessible for game page
window.store = store;

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
    
    case 'SET_SELECTED_CHARACTER':
      return { ...state, selectedCharacter: action.payload };
    
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
        tabId: state.tabId, // Preserve tab ID on reset
        players: [],
        gameState: null,
        chatMessages: [],
        countdownTime: null,
        countdownActive: false,
        gameStarted: false,
        selectedCharacter: null
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
  const state = store.getState();
  
  // Only process if this message is for this tab
  if (data.tabId && data.tabId !== state.tabId) {
    console.log('Ignoring game-state meant for different tab');
    return;
  }
  
  console.log('Game state received, players:', data.players);
  store.dispatch({ type: 'SET_PLAYERS', payload: data.players || [] });
  store.dispatch({ type: 'SET_GAME_STARTED', payload: data.gameStarted || false });
  
  if (data.countdownActive && data.countdownTime !== null) {
    store.dispatch({ type: 'SET_COUNTDOWN', payload: data.countdownTime });
  }
  
  // ✅ CRITICAL: Re-render if on waiting page
  const currentState = store.getState();
  if (currentState.currentPage === 'waiting') {
    renderApp();
  }
});

ws.on('player-id', (data) => {
  const state = store.getState();
  
  // Only process if this message is for this tab
  if (data.tabId && data.tabId !== state.tabId) {
    console.log('Ignoring player-id meant for different tab');
    return;
  }
  
  console.log('Player ID received:', data.playerId);
  store.dispatch({ type: 'SET_PLAYER_ID', payload: data.playerId });
});

ws.on('player-joined', (data) => {
  const state = store.getState();
  
  // Only process if this message is for this tab
  if (data.tabId && data.tabId !== state.tabId) {
    console.log('Ignoring player-joined meant for different tab');
    return;
  }
  
  console.log('Player joined, updating players:', data.players);
  store.dispatch({ type: 'SET_PLAYERS', payload: data.players || [] });
  
  // ✅ CRITICAL: Re-render immediately when player joins
  const currentState = store.getState();
  if (currentState.currentPage === 'waiting') {
    console.log('Re-rendering waiting room after player join');
    renderApp();
  }
});

ws.on('player-left', (data) => {
  const state = store.getState();
  
  // Only process if this message is for this tab
  if (data.tabId && data.tabId !== state.tabId) {
    console.log('Ignoring player-left meant for different tab');
    return;
  }
  
  console.log('Player left, updating players:', data.players);
  store.dispatch({ type: 'SET_PLAYERS', payload: data.players || [] });
  
  // ✅ Re-render if on waiting page
  const currentState = store.getState();
  if (currentState.currentPage === 'waiting') {
    renderApp();
  }
});

ws.on('chat-message', (data) => {
  const state = store.getState();
  
  // Chat messages are global, but only update if we're in a game or waiting for this tab
  if (state.currentPage === 'waiting' || state.gameStarted) {
    console.log('Chat message received:', data.message);
    store.dispatch({
      type: 'ADD_CHAT_MESSAGE',
      payload: {
        nickname: data.nickname,
        message: data.message,
        timestamp: data.timestamp
      }
    });
    
    // Update chat in game if active
    if (cleanupGame && cleanupGame.updateChat) {
      cleanupGame.updateChat();
    }
    
    // ✅ Re-render waiting room to show new chat message
    if (state.currentPage === 'waiting') {
      renderApp();
    }
  }
});

ws.on('countdown-start', (data) => {
  const state = store.getState();
  
  // Only process if this message is for this tab
  if (data.tabId && data.tabId !== state.tabId) {
    console.log('Ignoring countdown-start meant for different tab');
    return;
  }
  
  console.log('Countdown started');
  store.dispatch({ type: 'SET_COUNTDOWN', payload: data.time });
  
  // Update countdown
  const countdownInterval = setInterval(() => {
    const currentState = store.getState();
    if (currentState.countdownTime !== null && currentState.countdownTime > 0) {
      const newTime = Math.max(0, currentState.countdownTime - 100);
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
  const state = store.getState();
  
  // Only process if this message is for this tab
  if (data.tabId && data.tabId !== state.tabId) {
    console.log('Ignoring game-start meant for different tab');
    return;
  }
  
  console.log('Game starting');
  store.dispatch({ type: 'SET_GAME_STATE', payload: data.gameState });
  store.dispatch({ type: 'SET_GAME_STARTED', payload: true });
  
  // Ensure we have player ID
  const currentState = store.getState();
  if (!currentState.playerId && data.gameState && data.gameState.players) {
    // Find our player by nickname
    const players = Object.keys(data.gameState.players);
    const ourPlayer = players.find(id => {
      const player = data.gameState.players[id];
      return player && player.nickname === currentState.nickname;
    });
    if (ourPlayer) {
      store.dispatch({ type: 'SET_PLAYER_ID', payload: ourPlayer });
    }
  }
  
  store.dispatch({ type: 'SET_PAGE', payload: 'game' });
  renderApp();
});

ws.on('error', (data) => {
  const state = store.getState();
  
  // Only process if this error is for this tab
  if (data.tabId && data.tabId !== state.tabId) {
    console.log('Ignoring error meant for different tab');
    return;
  }
  
  // Handle server errors (e.g., duplicate nickname, game full, etc.)
  const errorMessage = data.message || 'An error occurred';
  alert(errorMessage);
  
  // If we're on the waiting page due to a failed join, go back to nickname page
  const currentState = store.getState();
  if (currentState.currentPage === 'waiting' && !currentState.playerId) {
    store.dispatch({ type: 'SET_PAGE', payload: 'nickname' });
    renderApp();
  }
});

ws.on('session-terminated', (data) => {
  const state = store.getState();
  
  // Only process if this message is for this tab
  if (data.tabId && data.tabId !== state.tabId) {
    console.log('Ignoring session-terminated meant for different tab');
    return;
  }
  
  // Handle game session termination (e.g., no players remaining)
  const message = data.message || 'Game session terminated - no players remaining';
  console.log('Session terminated:', message);
  
  // Reset game state
  store.dispatch({ type: 'RESET' });
  
  // Navigate back to nickname page
  store.dispatch({ type: 'SET_PAGE', payload: 'nickname' });
  renderApp();
  
  // Show notification to user
  alert(message);
});

// Handle nickname submission
function handleJoin(nickname, selectedCharacter) {
  const state = store.getState();
  
  console.log('handleJoin called with:', nickname);
  console.log('WebSocket connected?', ws.connected);
  
  store.dispatch({ type: 'SET_NICKNAME', payload: nickname });
  store.dispatch({ type: 'SET_SELECTED_CHARACTER', payload: selectedCharacter });
  
  // Connect WebSocket if not connected
  if (!ws.connected) {
    console.log('WebSocket not connected, connecting now...');
    ws.connect().then(() => {
      console.log('✅ WebSocket connected, sending join message');
      ws.send({ 
        type: 'join', 
        nickname: nickname,
        tabId: state.tabId,
        character: selectedCharacter ? {
          name: selectedCharacter.name,
          folder: selectedCharacter.folder,
          basePath: selectedCharacter.basePath
        } : null
      });
    }).catch(error => {
      console.error('❌ Failed to connect:', error);
      alert('Failed to connect to server. Please make sure the server is running.');
    });
  } else {
    console.log('✅ WebSocket already connected, sending join message');
    ws.send({ 
      type: 'join', 
      nickname: nickname,
      tabId: state.tabId,
      character: selectedCharacter ? {
        name: selectedCharacter.name,
        folder: selectedCharacter.folder,
        basePath: selectedCharacter.basePath
      } : null
    });
  }
  
  // Navigate directly to waiting room
  store.dispatch({ type: 'SET_PAGE', payload: 'waiting' });
  renderApp();
}

// Handle chat message
function handleChatMessage(message) {
  const state = store.getState();
  ws.send({ 
    type: 'chat', 
    message: message,
    tabId: state.tabId // Send tab ID with chat
  });
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
        cleanupGame = createGamePage(state.gameState, state.playerId, ws, handleChatMessage, state.chatMessages);
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
  // Only render if we're not in game phase, but always update waiting room for chat
  if (state.currentPage !== 'game') {
    renderApp();
  }
});

// Initialize app
function init() {
  console.log('App initializing, connecting to WebSocket...');
  
  // Connect to WebSocket
  ws.connect()
    .then(() => {
      console.log('✅ WebSocket connected successfully');
    })
    .catch(error => {
      console.error('❌ WebSocket connection failed:', error);
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
