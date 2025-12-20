// Character Selection Page
import { createElement } from '../framework/index.js';

export function createCharacterSelectionPage(onCharacterSelect) {
  let selectedCharacter = null;

  const characters = [
    { id: 'A', name: 'Character A', image: 'character/A.png' },
    { id: 'B', name: 'Character B', image: 'character/B.png' },
    { id: 'C', name: 'Character C', image: 'character/c.png' },
    { id: 'D', name: 'Character D', image: 'character/D.png' },
    { id: 'E', name: 'Character E', image: 'character/E.png' },
    { id: 'F', name: 'Character F', image: 'character/F.jpg' }
  ];

  const handleCharacterClick = (character) => {
    selectedCharacter = character;
    
    // Update UI to show selection
    document.querySelectorAll('.character-option').forEach(option => {
      option.classList.remove('selected');
    });
    document.querySelector(`[data-character-id="${character.id}"]`).classList.add('selected');
    
    // Update info text
    const infoElement = document.querySelector('.character-info p');
    if (infoElement) {
      infoElement.textContent = `Selected: ${character.name}`;
    }
    
    // Enable continue button
    const continueButton = document.querySelector('.continue-button');
    if (continueButton) {
      continueButton.disabled = false;
    }
  };

  const handleSubmit = () => {
    if (selectedCharacter) {
      onCharacterSelect(selectedCharacter);
    }
  };

  const characterOptions = characters.map(character => 
    createElement('div', {
      className: 'character-option',
      'data-character-id': character.id,
      onClick: () => handleCharacterClick(character)
    },
      createElement('img', {
        src: character.image,
        alt: character.name,
        className: 'character-image'
      }),
      createElement('div', { className: 'character-name' }, character.name)
    )
  );

  return createElement('div', { className: 'character-selection-page' },
    createElement('div', { className: 'character-selection-container' },
      createElement('h1', {}, 'Choose Your Character'),
      createElement('div', { className: 'characters-grid' }, ...characterOptions),
      createElement('div', { className: 'character-info' },
        createElement('p', {}, 'Click on a character to select')
      ),
      createElement('button', {
        className: 'continue-button',
        onClick: handleSubmit,
        disabled: true
      }, 'Continue')
    )
  );
}
