const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const WS_PORT = 3001;

// HTTP server for serving static files
const server = http.createServer((req, res) => {
  // Remove query string and hash from URL
  let urlPath = req.url.split('?')[0].split('#')[0];
  let filePath = '.' + urlPath;
  
  // Handle root path
  if (filePath === './' || filePath === '.') {
    filePath = './index.html';
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - File Not Found</h1>', 'utf-8');
        res.end('<a href="/">Go to Home</a>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`, 'utf-8');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`HTTP Server running on http://localhost:${PORT}`);
});

// WebSocket server for game
const wss = new WebSocket.Server({ port: WS_PORT });

const gameState = {
  players: [],
  gameStarted: false,
  gameState: null,
  waitingStartTime: null,
  countdownStartTime: null,
  countdownActive: false
};

const MAX_PLAYERS = 4;
const WAIT_TIME = 20000; // 20 seconds
const COUNTDOWN_TIME = 10000; // 10 seconds

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(ws, data);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    // Remove player from game
    const playerIndex = gameState.players.findIndex(p => p.ws === ws);
    if (playerIndex !== -1) {
      const player = gameState.players[playerIndex];
      gameState.players.splice(playerIndex, 1);
      broadcast({
        type: 'player-left',
        playerId: player.id,
        players: gameState.players.map(p => ({ id: p.id, nickname: p.nickname }))
      });
      checkGameStart();
    }
  });

  // Send current game state to new connection
  ws.send(JSON.stringify({
    type: 'game-state',
    players: gameState.players.map(p => ({ id: p.id, nickname: p.nickname })),
    gameStarted: gameState.gameStarted,
    countdownActive: gameState.countdownActive,
    countdownTime: gameState.countdownActive ? 
      Math.max(0, COUNTDOWN_TIME - (Date.now() - gameState.countdownStartTime)) : null
  }));
});

function handleMessage(ws, data) {
  switch (data.type) {
    case 'join':
      handleJoin(ws, data.nickname);
      break;
    case 'chat':
      handleChat(ws, data.message);
      break;
    case 'player-move':
      handlePlayerMove(ws, data);
      break;
    case 'place-bomb':
      handlePlaceBomb(ws, data);
      break;
    case 'game-ready':
      handleGameReady(ws);
      break;
    default:
      console.log('Unknown message type:', data.type);
  }
}

function handleJoin(ws, nickname) {
  if (gameState.players.length >= MAX_PLAYERS) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Game is full'
    }));
    return;
  }

  if (gameState.gameStarted) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Game already started'
    }));
    return;
  }

  const playerId = `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const player = {
    id: playerId,
    nickname: nickname || `Player ${gameState.players.length + 1}`,
    ws: ws,
    ready: false
  };

  gameState.players.push(player);

  // Send player ID to the joining client
  ws.send(JSON.stringify({
    type: 'player-id',
    playerId: player.id
  }));

  broadcast({
    type: 'player-joined',
    player: { id: player.id, nickname: player.nickname },
    players: gameState.players.map(p => ({ id: p.id, nickname: p.nickname }))
  }, ws);

  checkGameStart();
}

function handleChat(ws, message) {
  const player = gameState.players.find(p => p.ws === ws);
  if (!player) return;

  broadcast({
    type: 'chat-message',
    playerId: player.id,
    nickname: player.nickname,
    message: message,
    timestamp: Date.now()
  });
}

function handlePlayerMove(ws, data) {
  if (!gameState.gameStarted || !gameState.gameState) return;
  
  const player = gameState.players.find(p => p.ws === ws);
  if (!player) return;

  // Update game state
  if (gameState.gameState.players[player.id]) {
    gameState.gameState.players[player.id].x = data.x;
    gameState.gameState.players[player.id].y = data.y;
    
    // Check for power-up collection
    checkPowerUpCollection(player.id, data.x, data.y);
  }

  // Broadcast to all other players
  broadcast({
    type: 'player-moved',
    playerId: player.id,
    x: data.x,
    y: data.y
  }, ws);
}

function checkPowerUpCollection(playerId, x, y) {
  if (!gameState.gameState.powerUps) return;

  const powerUpIndex = gameState.gameState.powerUps.findIndex(pu => 
    Math.floor(pu.x) === Math.floor(x) && Math.floor(pu.y) === Math.floor(y)
  );

  if (powerUpIndex !== -1) {
    const powerUp = gameState.gameState.powerUps[powerUpIndex];
    const player = gameState.gameState.players[playerId];

    if (player) {
      switch (powerUp.type) {
        case 'bombs':
          player.maxBombs = (player.maxBombs || 1) + 1;
          break;
        case 'flames':
          player.explosionRange = (player.explosionRange || 1) + 1;
          break;
        case 'speed':
          player.speed = (player.speed || 1) + 0.5;
          break;
      }

      // Remove power-up
      gameState.gameState.powerUps.splice(powerUpIndex, 1);

      // Broadcast power-up collection
      broadcast({
        type: 'power-up-collected',
        playerId: playerId,
        powerUpType: powerUp.type,
        gameState: gameState.gameState
      });
    }
  }
}

function handlePlaceBomb(ws, data) {
  if (!gameState.gameStarted || !gameState.gameState) return;
  
  const player = gameState.players.find(p => p.ws === ws);
  if (!player) return;

  // Add bomb to game state
  const bombId = `bomb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const bomb = {
    id: bombId,
    playerId: player.id,
    x: data.x,
    y: data.y,
    placedAt: Date.now(),
    explosionRange: gameState.gameState.players[player.id].explosionRange || 1
  };

  if (!gameState.gameState.bombs) {
    gameState.gameState.bombs = [];
  }
  gameState.gameState.bombs.push(bomb);

  // Broadcast bomb placement
  broadcast({
    type: 'bomb-placed',
    bomb: bomb
  });
}

function handleGameReady(ws) {
  const player = gameState.players.find(p => p.ws === ws);
  if (!player) return;

  player.ready = true;

  // Check if all players are ready
  if (gameState.players.length >= 2 && gameState.players.every(p => p.ready)) {
    startGame();
  }
}

function checkGameStart() {
  const playerCount = gameState.players.length;

  if (playerCount >= 2 && !gameState.waitingStartTime && !gameState.countdownActive) {
    // Start 20 second wait timer
    gameState.waitingStartTime = Date.now();
    
    setTimeout(() => {
      if (gameState.players.length >= 2 && !gameState.gameStarted && !gameState.countdownActive) {
        startCountdown();
      }
    }, WAIT_TIME);
  }

  if (playerCount === MAX_PLAYERS && !gameState.gameStarted && !gameState.countdownActive) {
    startCountdown();
  }
}

function startCountdown() {
  if (gameState.countdownActive) return;

  gameState.countdownActive = true;
  gameState.countdownStartTime = Date.now();

  broadcast({
    type: 'countdown-start',
    time: COUNTDOWN_TIME
  });

  setTimeout(() => {
    if (gameState.players.length >= 2) {
      startGame();
    } else {
      gameState.countdownActive = false;
      gameState.countdownStartTime = null;
    }
  }, COUNTDOWN_TIME);
}

function startGame() {
  if (gameState.gameStarted) return;

  gameState.gameStarted = true;
  gameState.countdownActive = false;
  gameState.waitingStartTime = null;
  gameState.countdownStartTime = null;

  // Initialize game state
  const GRID_SIZE = 15;
  gameState.gameState = {
    map: generateMap(GRID_SIZE),
    players: {},
    bombs: [],
    powerUps: [],
    explosions: []
  };

  // Initialize players in corners
  const corners = [
    { x: 1, y: 1 },
    { x: GRID_SIZE - 2, y: 1 },
    { x: 1, y: GRID_SIZE - 2 },
    { x: GRID_SIZE - 2, y: GRID_SIZE - 2 }
  ];

  gameState.players.forEach((player, index) => {
    const corner = corners[index];
    gameState.gameState.players[player.id] = {
      id: player.id,
      nickname: player.nickname,
      x: corner.x,
      y: corner.y,
      lives: 3,
      maxBombs: 1,
      explosionRange: 1,
      speed: 1,
      bombsPlaced: 0
    };
  });

  broadcast({
    type: 'game-start',
    gameState: gameState.gameState
  });

  // Start game loop
  startGameLoop();
}

function generateMap(size) {
  const map = [];
  
  // Initialize empty map
  for (let y = 0; y < size; y++) {
    map[y] = [];
    for (let x = 0; x < size; x++) {
      map[y][x] = 0; // 0 = empty, 1 = wall, 2 = destroyable block
    }
  }

  // Place walls in grid pattern
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x % 2 === 1 && y % 2 === 1) {
        map[y][x] = 1; // Wall
      }
    }
  }

  // Place destroyable blocks randomly (but not in corners or starting positions)
  const corners = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 },
    { x: size - 1, y: 0 }, { x: size - 2, y: 0 }, { x: size - 1, y: 1 },
    { x: 0, y: size - 1 }, { x: 1, y: size - 1 }, { x: 0, y: size - 2 },
    { x: size - 1, y: size - 1 }, { x: size - 2, y: size - 1 }, { x: size - 1, y: size - 2 }
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (map[y][x] === 0) {
        const isCorner = corners.some(c => c.x === x && c.y === y);
        if (!isCorner && Math.random() > 0.4) {
          map[y][x] = 2; // Destroyable block
        }
      }
    }
  }

  return map;
}

function startGameLoop() {
  const gameLoop = setInterval(() => {
    if (!gameState.gameStarted || !gameState.gameState) {
      clearInterval(gameLoop);
      return;
    }

    const now = Date.now();
    const BOMB_EXPLODE_TIME = 3000; // 3 seconds

    // Check for bomb explosions
    if (gameState.gameState.bombs) {
      const explodedBombs = [];
      gameState.gameState.bombs.forEach((bomb, index) => {
        if (now - bomb.placedAt >= BOMB_EXPLODE_TIME) {
          explodedBombs.push({ bomb, index });
        }
      });

      explodedBombs.forEach(({ bomb, index }) => {
        explodeBomb(bomb);
        gameState.gameState.bombs.splice(index, 1);
      });
    }

    // Broadcast game state updates
    broadcast({
      type: 'game-update',
      gameState: gameState.gameState
    });
  }, 100); // Update every 100ms
}

function explodeBomb(bomb) {
  const explosions = [];
  const range = bomb.explosionRange;
  const directions = [
    { dx: 0, dy: -1 }, // up
    { dx: 1, dy: 0 },  // right
    { dx: 0, dy: 1 },  // down
    { dx: -1, dy: 0 }   // left
  ];

  // Center explosion
  explosions.push({ x: bomb.x, y: bomb.y });

  // Explosions in each direction
  directions.forEach(dir => {
    for (let i = 1; i <= range; i++) {
      const x = bomb.x + dir.dx * i;
      const y = bomb.y + dir.dy * i;

      if (x < 0 || x >= 15 || y < 0 || y >= 15) break;

      const cell = gameState.gameState.map[y][x];
      if (cell === 1) break; // Wall stops explosion
      
      explosions.push({ x, y });

      if (cell === 2) {
        // Destroy block
        gameState.gameState.map[y][x] = 0;
        
        // Random chance to spawn power-up
        if (Math.random() < 0.3) {
          const powerUpTypes = ['bombs', 'flames', 'speed'];
          const powerUpType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
          gameState.gameState.powerUps.push({
            id: `powerup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: powerUpType,
            x: x,
            y: y
          });
        }
        break; // Block stops explosion
      }
    }
  });

  // Check for player damage
  Object.keys(gameState.gameState.players).forEach(playerId => {
    const player = gameState.gameState.players[playerId];
    const hit = explosions.some(exp => exp.x === player.x && exp.y === player.y);
    
    if (hit && player.lives > 0) {
      player.lives--;
      if (player.lives === 0) {
        // Player eliminated
        broadcast({
          type: 'player-eliminated',
          playerId: playerId
        });
      }
    }
  });

  // Broadcast explosion
  broadcast({
    type: 'bomb-exploded',
    explosions: explosions,
    gameState: gameState.gameState
  });
}

function broadcast(message, excludeWs = null) {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
      client.send(data);
    }
  });
}

console.log(`WebSocket Server running on ws://localhost:${WS_PORT}`);

