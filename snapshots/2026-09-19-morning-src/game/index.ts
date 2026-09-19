// Agent 2's entry. main.ts (agent 1) calls startGame once the world is built.

import type { GameBoot } from '../core/contracts';
import { createUI } from '../ui';
import { audio } from '../audio';
import { Game } from './game';
import { Lineup } from './lineup';
import { withNarration } from './narration';
import { hasSave, loadGame, newGame, wasLive } from './state';
import { buildCharacter, Race, Role, SUGGESTED, SUGGESTED_PICKS, canPick, SPECS } from '../rules/character';

export async function startGame(boot: GameBoot) {
  // Every line on screen is also spoken (src/audio/voice.ts).
  const ui = withNarration(createUI());
  ui.mount(boot.root);
  // The first click anywhere unlocks WebAudio.
  const unlock = () => {
    audio.init();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  let current: Game | null = null;

  const toTitle = async (): Promise<void> => {
    current = null;
    ui.showHud(false);
    boot.world.setMode('cutscene');
    audio.setMusic('title', 2);
    audio.setAmbience('desert', 2);
    // A slow look over the level behind the title.
    void boot.world.focus(boot.world.level.playerSpawn, { zoom: 0.8, duration: 2 });

    // A reload mid-game (a code edit, a crash) resumes the autosave instead of showing the title.
    const autoContinue = location.hash === '#continue' || wasLive();
    if (autoContinue) history.replaceState(null, '', location.pathname);
    const canContinue = await hasSave();
    const quickStart = new URLSearchParams(location.search).has('quick');
    const pick = autoContinue && canContinue ? 'continue' : quickStart ? 'new' : await ui.title({ canContinue });
    audio.init();

    if (pick === 'continue') {
      const st = await loadGame();
      if (st) {
        await ui.fade('black', 500);
        current = new Game(boot.world, boot.bus, ui, st, () => location.reload());
        await current.start(false);
        await ui.fade('clear', 700);
        return;
      }
    }
    // Test hook: ?quick=iskari-tech skips the title and creation.
    const quick = new URLSearchParams(location.search).get('quick');
    // the six bodies stand in the world behind the creation panel
    // open sand north of the ridge: nothing behind the six bodies but desert and the ruin (round 2)
    const lineup = new Lineup(boot.world, { x: 32, y: 41 }); // open sand east of the camp, nothing tall to its south-west
    (window as any).__lineup = lineup;
    const ch = quick ? quickCharacter(quick) : await ui.createCharacter((s) => lineup.show(s));
    lineup.clear();
    const character = buildCharacter(ch.name.trim() || 'Stranger', ch.race, ch.role, ch.stats, ch.picks, ch.body);
    await ui.fade('black', 600);
    const state = newGame(character);
    current = new Game(boot.world, boot.bus, ui, state, () => location.reload());
    const started = current.start(true);
    await ui.fade('clear', 900);
    await started;
  };

  // Do not await: main.ts waits for startGame before it lifts the boot screen.
  void toTitle();
  (window as any).__game = () => current;
}

function quickCharacter(q: string) {
  const [race, role, sex] = q.split('-') as [Race, Role, string?];
  const picks = SUGGESTED_PICKS[role].filter((s) => canPick(race, s));
  for (const s of SPECS) if (picks.length < 2 && canPick(race, s) && !picks.includes(s)) picks.push(s);
  return { name: 'Tester', race, role, stats: { ...SUGGESTED[role] }, picks, body: (sex === 'female' ? 'female' : 'male') as 'male' | 'female' };
}
