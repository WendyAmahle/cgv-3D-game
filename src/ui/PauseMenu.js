const $ = (selector) => document.querySelector(selector);

// Keeps the settings toggle labels in sync with current settings. Mute is
// saved between visits, so its state shows on the main menu, the HUD and the
// pause menu, never only behind the M key.
export class PauseMenu {
  setQuality(quality) {
    $('#qualityButton').textContent = `Graphics: ${quality === 'high' ? 'High' : 'Low'}`;
  }

  setMuted(muted) {
    $('#muteButton').textContent = `Sound: ${muted ? 'Off' : 'On'}`;
    $('#menuSoundButton').textContent = `Sound: ${muted ? 'Off' : 'On'}`;
    const hud = $('#hudSoundButton');
    hud.textContent = muted ? '🔇 Muted' : '🔊 Sound';
    hud.classList.toggle('off', muted);
  }
}
