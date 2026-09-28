const $ = (selector) => document.querySelector(selector);

// Keeps the pause menu's toggle labels in sync with current settings.
export class PauseMenu {
  setQuality(quality) {
    $('#qualityButton').textContent = `Graphics: ${quality === 'high' ? 'High' : 'Low'}`;
  }

  setMuted(muted) {
    $('#muteButton').textContent = `Sound: ${muted ? 'Off' : 'On'}`;
  }
}
