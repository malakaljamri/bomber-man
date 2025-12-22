// Utility to discover and load playable characters
// Finds all folders in src/playable-characters and extracts character data

export async function discoverCharacters() {
  const characters = [];
  
  // Character folders in the new structure (src/playable-characters/)
  const characterNames = [
    'Sandy',
    'SpongeBob',
    'Patrick',
    'Squidward'
  ];

  // Load all characters in parallel
  const characterPromises = characterNames.map(async (characterName) => {
    try {
      // New path structure: src/playable-characters/CharacterName
      const basePath = `src/playable-characters/${characterName}`;
      
      // Try to find an idle sprite as preview image
      // Use the first idle sprite from Down/Idle folder
      const previewPath = `${basePath}/Down/Idle/1.png`;
      
      // Check if the image exists by trying to load it
      const imageExists = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = previewPath;
        // Timeout after 2 seconds
        setTimeout(() => resolve(false), 2000);
      });

      if (imageExists) {
        return {
          name: characterName,
          folder: basePath,
          previewImage: previewPath,
          // Store the base path for sprite loading in game
          basePath: basePath
        };
      }
      return null;
    } catch (error) {
      console.warn(`Failed to load character ${characterName}:`, error);
      return null;
    }
  });

  const results = await Promise.all(characterPromises);
  return results.filter(char => char !== null);
}

// Get character sprite path for a specific animation
export function getCharacterSpritePath(characterFolder, direction, animation, frame) {
  // Directions: 'Down', 'Up', 'Left', 'Right'
  // Animations: 'Idle', 'Walk', 'Kick', 'Power', 'Kamikaze', 'Blasted'
  return `${characterFolder}/${direction}/${animation}/${frame}.png`;
}

