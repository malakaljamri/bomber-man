// Nickname Entry Page
import { createElement } from '../framework/index.js';

export function createNicknamePage(onJoin) {
  let nickname = '';

  const handleInput = (e) => {
    nickname = e.target.value.trim();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (nickname) {
      onJoin(nickname);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && nickname) {
      handleSubmit(e);
    }
  };

  return createElement('div', { className: 'nickname-page' },
    createElement('div', { className: 'nickname-container' },
      createElement('h1', {}, 'Bomberman DOM'),
      createElement('form', { onSubmit: handleSubmit },
        createElement('input', {
          type: 'text',
          className: 'nickname-input',
          placeholder: 'Enter your nickname',
          value: nickname,
          onInput: handleInput,
          onKeyPress: handleKeyPress,
          maxLength: 20,
          autoFocus: true
        }),
        createElement('button', {
          type: 'submit',
          className: 'join-button'
        }, 'Join Game')
      )
    )
  );
}

