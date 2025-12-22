// Nickname Entry Page
import { createElement } from '../framework/index.js';
import { discoverCharacters } from '../utils/character-loader.js';

export function createNicknamePage(onJoin) {
  let nickname = '';
  let selectedCharacter = null;
  let availableCharacters = [];
  let charactersLoading = true;
  
  const updateCharacterGrid = () => {
    const gridContainer = document.querySelector('.characters-grid-container');
    if (!gridContainer) return;
    
    if (charactersLoading) {
      gridContainer.innerHTML = '<p style="color: #666; margin: 20px 0;">Loading characters...</p>';
      return;
    }
    
    if (availableCharacters.length === 0) {
      gridContainer.innerHTML = '<p style="color: #e74c3c; margin: 20px 0;">No characters available</p>';
      return;
    }
    
    const grid = document.createElement('div');
    grid.className = 'characters-grid';
    
    availableCharacters.forEach(character => {
      const isSelected = selectedCharacter && selectedCharacter.name === character.name;
      const option = document.createElement('div');
      option.className = `character-option ${isSelected ? 'selected' : ''}`;
      option.addEventListener('click', () => {
        selectedCharacter = character;
        updateCharacterGrid();
        updateJoinButton();
      });
      
      const img = document.createElement('img');
      img.src = character.previewImage;
      img.alt = character.name;
      img.className = 'character-image';
      img.onerror = () => { img.style.display = 'none'; };
      
      const name = document.createElement('div');
      name.className = 'character-name';
      name.textContent = character.name;
      
      option.appendChild(img);
      option.appendChild(name);
      grid.appendChild(option);
    });
    
    gridContainer.innerHTML = '';
    gridContainer.appendChild(grid);
  };
  
  const updateJoinButton = () => {
    const button = document.querySelector('.join-button');
    if (button) {
      button.disabled = !nickname || !selectedCharacter || charactersLoading;
    }
  };
  
  const handleInput = (e) => {
    nickname = e.target.value.trim();
    updateJoinButton();
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (nickname && selectedCharacter) {
      onJoin(nickname, selectedCharacter);
    }
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && nickname && selectedCharacter) {
      handleSubmit(e);
    }
  };
  
  // Load available characters after a short delay to ensure DOM is ready
  setTimeout(() => {
    discoverCharacters().then(characters => {
      availableCharacters = characters;
      charactersLoading = false;
      // Auto-select first character if available
      if (characters.length > 0 && !selectedCharacter) {
        selectedCharacter = characters[0];
      }
      updateCharacterGrid();
      updateJoinButton();
    }).catch(error => {
      console.error('Failed to load characters:', error);
      charactersLoading = false;
      updateCharacterGrid();
      updateJoinButton();
    });
  }, 100);
  
  return createElement('div', { className: 'nickname-page' },
    createElement('div', { className: 'nickname-container' },
      createElement('h1', {}, 'Bomberman DOM'),
      createElement('div', { className: 'character-selection-section' },
        createElement('h2', { 
          style: 'margin-bottom: 20px; font-size: 1.5em; color: #667eea;' 
        }, 'Choose Your Character'),
        createElement('div', { className: 'characters-grid-container' })
      ),
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
          className: 'join-button',
          disabled: true
        }, 'Join Game')
      )
    )
  );
}

