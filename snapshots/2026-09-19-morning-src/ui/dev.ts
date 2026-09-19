// Visual test bench for the UI. Open /src/ui/dev.html#<scene>.
import { createUI } from './index';
import { buildCharacter } from '../rules/character';
import { bandOdds } from '../rules/dice';
import type { CheckResult } from '../rules/check';
import type { CombatBarState, HudState } from './types';

const ui = createUI();
ui.mount(document.getElementById('ui')!);
(window as unknown as { __ui: typeof ui }).__ui = ui;
ui.onHudAction((a) => ui.toast(a === 'sneak' ? 'Sneak toggled.' : `Ability ${a.ability}.`, 'neutral'));

const hero = buildCharacter('Ruun', 'sehari', 'channeller', { body: 0, edge: 1, mind: 1, will: 2, presence: 0, resonance: 3 }, ['crystalLore', 'channellingDepth']);
hero.specs.survival = 2;

const abilities = [
  { id: 'channelAmber', name: 'Channel amber', desc: 'Push raw force through an amber crystal held in your palm. Range 5.', key: '1', cooldown: 0, rollLabel: 'Resonance + Channelling depth (+4)' },
  { id: 'channelCrimson', name: 'Channel crimson', desc: 'Heals your worst wound.', key: '2', cooldown: 2 },
  { id: 'allFours', name: 'Run on all fours', desc: 'Three extra tiles of movement.', key: '3', cooldown: 0 },
  { id: 'focusedChannel', name: 'Steady breath', desc: '+2 to your next roll.', key: '4', cooldown: 0, disabled: 'You are already steady.' },
];

const hud = (mode: HudState['mode']): HudState => ({
  name: 'Ruun',
  race: 'sehari',
  role: 'channeller',
  raceLabel: 'Sehari',
  roleLabel: 'Channeller',
  wounds: { light: true, moderate: true, severe: false },
  guard: 1,
  guardMax: 3,
  penalty: -1,
  crystals: [
    { colour: 'amber', integrity: 3 },
    { colour: 'crimson', integrity: 1 },
    { colour: 'pale', integrity: 2 },
  ],
  abilities,
  sneaking: true,
  objective: 'Reach the fallen spire in the Ash Reach',
  mode,
});

const combat: CombatBarState = {
  round: 2,
  whoseTurn: 'player',
  moveLeft: 3,
  moveMax: 5,
  actionLeft: true,
  attackLabel: 'Strike (Body + Melee +1)',
  attackRange: 1,
  selected: 'channelAmber',
  abilities,
  items: [{ id: 'sap', name: 'Dust-aloe sap', count: 2, desc: 'Heals a light wound.' }],
  enemies: [
    { id: 'a', name: "Tel'sharin husk", harm: 2, harmMax: 4, stunned: 1 },
    { id: 'b', name: 'Scavenger', harm: 1, harmMax: 3, stunned: 0 },
    { id: 'c', name: 'Scavenger', harm: 3, harmMax: 3, stunned: 0 },
  ],
  log: [
    'The husk lurches forward.',
    'You channel amber. 11, full success.',
    'The husk takes 2 harm and is pushed back.',
    'A scavenger fires. Your guard holds.',
    'Round 2.',
  ],
};

const roll: CheckResult = {
  dice: [5, 4],
  terms: [
    { label: 'Resonance', value: 3 },
    { label: 'Channelling depth', value: 1 },
    { label: 'Wounds', value: -1 },
  ],
  mod: 3,
  total: 12,
  band: 'full',
  label: 'Read the symbol door',
};

const scenes: Record<string, () => void | Promise<void>> = {
  title: () => void ui.title({ canContinue: true }),
  creation: () => void ui.createCharacter().then((c) => console.log('created', c)),
  narrate: () =>
    void ui.narrate(
      [
        'The light is always low here.',
        'The red sun hangs where it has always hung, a coal on the rim of the world.',
        'The apprentice asked you for one thing. Bring back the *plate*.',
      ],
      { title: 'The Ash Reach' },
    ),
  hud: () => {
    ui.showHud(true);
    ui.updateHud(hud('explore'));
    ui.toast('Found an amber crystal.', 'crystal');
    ui.toast('New objective: cross the Ash Reach.', 'quest');
    ui.toast('You feel steadier.', 'good');
    ui.hoverLabel('Barrel-gourd', 'Take water');
    ui.bark({ x: 760, y: 360 }, 'Scavenger', 'You there. Walk on, *slow*.', 60000);
  },
  roll: async () => {
    ui.showHud(true);
    ui.updateHud(hud('explore'));
    await ui.roll(roll);
  },
  rollpartial: async () => {
    ui.showHud(true);
    ui.updateHud(hud('explore'));
    await ui.roll({ ...roll, dice: [2, 3], total: 8, band: 'partial', label: 'Channel amber at the husk' });
  },
  rollmiss: async () => {
    ui.showHud(true);
    ui.updateHud(hud('explore'));
    await ui.roll({ ...roll, dice: [1, 1], total: 5, band: 'miss', label: 'Climb the broken stair' });
  },
  dialogue: async () => {
    ui.showHud(true);
    ui.updateHud(hud('dialogue'));
    const i = await ui.dialogue({
      speaker: 'The apprentice',
      portrait: 'apprentice',
      text: 'My master kept a plate in the spire. It holds what he knew. I cannot go myself. *Will you?*',
      choices: [
        { text: 'I will go. Tell me the way.' },
        { text: 'What is on the plate?', seen: true },
        { text: 'Read the symbols on his sleeve.', tag: '[Mind + Lore]', odds: bandOdds(2) },
        { text: 'Speak to him in the old tongue.', tag: '[Iskari]', disabled: 'Only an Iskari knows the old tongue.' },
        { text: 'Not today.' },
      ],
    });
    console.log('picked', i);
  },
  rolllock: async () => {
    ui.showHud(true);
    ui.updateHud(hud('dialogue'));
    void ui.dialogue({ speaker: 'The apprentice', portrait: 'apprentice', text: 'Read it, then.', choices: [{ text: 'Read the symbols.', tag: '[Mind + Lore]', odds: bandOdds(2) }, { text: 'Leave it.' }] });
    await new Promise((r) => setTimeout(r, 500));
    await ui.roll(roll);
  },
  record: async () => {
    await ui.dialogue({ speaker: 'A voice in the crystal', portrait: 'record', text: 'If you hear this, the stair has fallen. Keep the plate dry. Keep it *away* from the dead-walkers.', choices: [] });
  },
  combat: () => {
    ui.showHud(true);
    ui.updateHud(hud('combat'));
    ui.combatBar(combat);
    ui.onCombatAction((a) => console.log('combat', a));
  },
  banner: () => {
    ui.showHud(true);
    ui.updateHud(hud('combat'));
    ui.combatBar(combat);
    void ui.banner('Your turn', 'Round 2');
  },
  journal: () => {
    ui.showHud(true);
    ui.updateHud(hud('explore'));
    ui.setJournal([
      { id: 'q1', title: "The Keeper's errand", lines: ['The apprentice asked you to fetch a plate from the fallen spire.', 'The spire lies south, across the Ash Reach.', 'A scavenger band watches the road.'], done: false },
      { id: 'q2', title: 'Water for the road', lines: ['Barrel-gourds hold water. Fill your skin.', 'You drank.'], done: true },
    ]);
    ui.togglePanel('journal');
  },
  inventory: () => {
    ui.showHud(true);
    ui.updateHud(hud('explore'));
    ui.setInventory(
      [
        { id: 'plate', name: 'Archive plate', count: 1, desc: 'Cool to the touch. Symbols move under the surface.', usable: false, quest: true },
        { id: 'sap', name: 'Dust-aloe sap', count: 3, desc: 'Heals a light wound.', usable: true },
        { id: 'amber', name: 'Amber crystal', count: 1, desc: 'Force. Integrity 3 of 3.', usable: false },
        { id: 'scrap', name: 'Tel\'sharin scrap', count: 5, desc: 'Warm metal. Someone in town will want it.', usable: false },
      ],
      (id) => ui.toast(`Used ${id}.`, 'good'),
    );
    ui.togglePanel('inventory');
  },
  character: () => {
    ui.showHud(true);
    ui.updateHud(hud('explore'));
    ui.setCharacter(hero, { lines: ['Wounds: light, moderate. -1 to every roll.', 'Crystals: amber, crimson, pale.'] });
    ui.togglePanel('character');
  },
  help: () => {
    ui.showHud(true);
    ui.updateHud(hud('explore'));
    ui.togglePanel('help');
  },
  menu: () => {
    ui.showHud(true);
    ui.updateHud(hud('explore'));
    ui.setMenu({
      onSave: async () => 'Saved. Slot 1, the Ash Reach.',
      onLoad: async () => 'Loaded.',
      onQuitToTitle: () => console.log('quit'),
      storageNote: 'Saves go to ./saves/ in the game folder.',
    });
    ui.togglePanel('menu');
  },
  ending: () =>
    void ui.ending({
      title: 'The empty workshop',
      lines: ['You brought the plate back across the Ash Reach.', 'The workshop door stood open. The apprentice was gone.', 'A note, half burned, lay on the bench.'],
      coda: 'The light is always low here. You are not done.',
      stats: [
        { label: 'Rolls', value: '23' },
        { label: 'Wounds taken', value: '4' },
        { label: 'Crystals used', value: '2' },
        { label: 'Time', value: '31 min' },
      ],
    }),
  fade: () => {
    ui.showHud(true);
    ui.updateHud(hud('explore'));
    void ui.fade('black', 400);
  },
};

const name = location.hash.slice(1) || 'title';
void scenes[name]?.();
