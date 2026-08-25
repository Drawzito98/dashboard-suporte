const game = require('../static/fibra-game-engine.js');

function buildAndConnectHouse(state, houseX, cableX) {
  state = game.build(state, 'house', houseX, 1);
  if (!state.cables.includes('3,2')) state = game.layFiber(state, 3, 2);
  state = game.layFiber(state, cableX, 2);
  const house = state.buildings.find(item => item.type === 'house' && item.x === houseX);
  return game.connectBuilding(state, house.id);
}

module.exports = ({ describe, it, assert }) => {
  describe('fibra city engine', () => {
    it('starts as a small provider with supplies but no infrastructure', () => {
      const state = game.initialState();
      assert.equal(state.money, 3000);
      assert.equal(state.fiber, 80);
      assert.equal(state.onus, 2);
      assert.equal(state.popLevel, 0);
    });

    it('builds the first POP only on a lot next to a road', () => {
      let state = game.initialState();
      assert.equal(game.build(state, 'pop', 0, 0).buildings.length, 0);
      state = game.build(state, 'pop', 3, 1);
      assert.equal(state.buildings[0].type, 'pop');
      assert.equal(state.popLevel, 1);
      assert.equal(game.popCapacity(state), 4);
    });

    it('keeps buildings on lots and network equipment on streets', () => {
      const state = game.initialState();
      assert.equal(game.build(state, 'house', 1, 2).buildings.length, 0);
      assert.equal(game.build(state, 'pole', 1, 1).buildings.length, 0);
      assert.equal(game.build(state, 'pole', 1, 2).buildings[0].type, 'pole');
    });

    it('lays fiber from the POP using money and cable stock', () => {
      let state = game.build(game.initialState(), 'pop', 3, 1);
      state = game.layFiber(state, 3, 2);
      assert.deepEqual(state.cables, ['3,2']);
      assert.equal(state.fiber, 70);
      assert.equal(state.money, 2080);
      assert.equal(game.layFiber(state, 8, 2).cables.length, 1);
    });

    it('connects a house with an ONU and consumes POP capacity', () => {
      let state = game.build(game.initialState(), 'pop', 3, 1);
      state = game.build(state, 'house', 2, 1);
      state = game.layFiber(state, 3, 2);
      state = game.layFiber(state, 2, 2);
      const house = state.buildings.find(item => item.type === 'house');
      state = game.connectBuilding(state, house.id);
      assert.equal(state.connected.length, 1);
      assert.equal(state.onus, 1);
      assert.equal(game.usedCapacity(state), 1);
    });

    it('unlocks commercial buildings as connected clients grow', () => {
      let state = game.build(game.initialState(), 'pop', 3, 1);
      state = buildAndConnectHouse(state, 2, 2);
      state = game.buyOnu(state);
      state = game.build(state, 'house', 5, 1);
      state = game.layFiber(state, 4, 1);
      const second = state.buildings.find(item => item.type === 'house' && item.x === 5);
      state = game.connectBuilding(state, second.id);
      assert.equal(game.cityLevel(state), 2);
      assert.equal(game.build(state, 'pharmacy', 6, 1).buildings.some(item => item.type === 'pharmacy'), true);
    });

    it('upgrades POP capacity and buys operational supplies', () => {
      let state = game.build(game.initialState(), 'pop', 3, 1);
      state = game.upgradePop(state);
      assert.equal(state.popLevel, 2);
      assert.equal(game.popCapacity(state), 8);
      const withOnu = game.buyOnu(state);
      const withFiber = game.buyFiber(withOnu);
      assert.equal(withOnu.onus, state.onus + 1);
      assert.equal(withFiber.fiber, state.fiber + 100);
    });

    it('collects revenue from active buildings and supports repairs', () => {
      let state = game.build(game.initialState(), 'pop', 3, 1);
      state = game.build(state, 'house', 2, 1);
      state = game.layFiber(state, 3, 2);
      state = game.layFiber(state, 2, 2);
      const house = state.buildings.find(item => item.type === 'house');
      state = game.connectBuilding(state, house.id);
      const next = game.advanceMonth(state, .9);
      assert.equal(next.money, state.money + 45);
      const outage = { ...next, outages: [house.id] };
      assert.equal(game.satisfaction(outage), 0);
      assert.equal(game.satisfaction(game.repairBuilding(outage, house.id)), 100);
    });
  });
};
