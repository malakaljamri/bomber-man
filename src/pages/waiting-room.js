// Waiting Room Page
import { createElement } from '../framework/index.js';

export function createWaitingRoom(state, onChatMessage) {
  const { players, countdownTime, chatMessages } = state;
  const playerCount = players.length;

  const handleChatSubmit = (e) => {
    e.preventDefault();
    const input = e.target.querySelector('.chat-input');
    const message = input.value.trim();
    if (message) {
      onChatMessage(message);
      input.value = '';
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const input = e.target;
      const message = input.value.trim();
      if (message) {
        onChatMessage(message);
        input.value = '';
      }
    }
  };

  const countdownDisplay = countdownTime !== null && countdownTime > 0
    ? createElement('div', { className: 'countdown' }, `Game starting in ${Math.ceil(countdownTime / 1000)}s`)
    : null;

  return createElement('div', { className: 'waiting-room' },
    createElement('div', { className: 'waiting-room-header' },
      createElement('h1', {}, 'Waiting Room'),
      createElement('div', { className: 'player-counter' },
        `Players: ${playerCount}/4`
      ),
      countdownDisplay
    ),
    createElement('div', { className: 'waiting-room-content' },
      createElement('div', { className: 'chat-section' },
        createElement('h2', {}, 'Chat'),
        createElement('div', { className: 'chat-messages' },
          ...chatMessages.map(msg =>
            createElement('div', { className: 'chat-message' },
              createElement('span', { className: 'nickname' }, `${msg.nickname}: `),
              createElement('span', {}, msg.message)
            )
          )
        ),
        createElement('form', { className: 'chat-input-container', onSubmit: handleChatSubmit },
          createElement('input', {
            type: 'text',
            className: 'chat-input',
            placeholder: 'Type a message...',
            onKeyPress: handleKeyPress
          }),
          createElement('button', {
            type: 'submit',
            className: 'chat-send'
          }, 'Send')
        )
      ),
      createElement('div', { className: 'players-list' },
        createElement('h2', {}, 'Players'),
        ...players.map(player =>
          createElement('div', { className: 'player-item' }, player.nickname)
        )
      )
    )
  );
}

