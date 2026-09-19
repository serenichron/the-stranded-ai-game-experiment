import type { Bus, WorldEvents } from '../core/contracts';
import type { World } from './world';

// Debug mode used only when the game entry (src/game/index.ts) is missing.
// Spawns an Iskari at the level spawn and walks wherever you click.
export function freeRoam(world: World, bus: Bus<WorldEvents>) {
  const lv = world.level;
  const kind = (new URLSearchParams(location.search).get('race') ?? 'iskari') as 'iskari' | 'sehari' | 'minaa';
  const id = world.spawn(`player-${kind}`, lv.playerSpawn, { id: 'player', faction: 'player', facing: lv.playerFacing });
  world.follow(id);
  bus.on('tile:click', ({ tile }) => {
    const p = world.get(id)!;
    const path = world.findPath(p.tile, tile);
    if (path) world.moveAlong(id, path, 3.2).catch(() => {});
  });
  bus.on('entity:click', ({ id: target }) => {
    const p = world.get(id)!, t = world.get(target)!;
    const path = world.findPath(p.tile, t.tile, { adjacentOk: true });
    if (path) world.moveAlong(id, path, 3.2).then(() => world.face(id, target)).catch(() => {});
  });
  bus.on('zone:enter', ({ zoneId }) => world.floatText(id, zoneId, 'neutral'));
}
