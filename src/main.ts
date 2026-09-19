import { Bus, type WorldEvents, type GameBoot } from './core/contracts';
import { World } from './engine/world';
import { level1 } from './level/level1';

// Boot: build the world, then hand over to the game (agent 2) if its entry exists yet.
async function boot() {
  const stage = document.getElementById('stage')!;
  const root = document.getElementById('ui')!;
  const bus = new Bus<WorldEvents>();
  const world = new World(stage, bus, level1);
  await world.ready;

  const entries = import.meta.glob('./game/index.ts');
  const load = entries['./game/index.ts'];
  const params = new URLSearchParams(location.search);
  if (load && !params.has('freeroam')) {
    const mod = (await load()) as { startGame?: (b: GameBoot) => void | Promise<void> };
    await mod.startGame?.({ world, bus, root });
  } else {
    // No game yet: free-roam the level so the world can be checked on its own.
    const { freeRoam } = await import('./engine/freeroam');
    freeRoam(world, bus);
  }
  const bootEl = document.getElementById('boot');
  if (bootEl) { bootEl.style.opacity = '0'; setTimeout(() => bootEl.remove(), 900); }
  (window as any).__world = world;
  (window as any).__bus = bus;
}

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById('boot');
  if (el) el.textContent = 'Failed to start: ' + (err?.message ?? err);
});
