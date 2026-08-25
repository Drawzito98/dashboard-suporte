const game = require('../static/fibra-game-engine.js');

module.exports = ({ describe, it, assert }) => {
  describe('fibra game engine', () => {
    it('starts with a light deterministic map and budget', () => {
      const state = game.initialState();
      assert.equal(state.budget, 1200);
      assert.equal(state.cables.length, 0);
      assert.equal(game.WIDTH * game.HEIGHT, 70);
    });

    it('only installs cable next to the existing network', () => {
      const state = game.initialState();
      assert.equal(game.placeCable(state, 5, 3).cables.length, 0);
      const installed = game.placeCable(state, 0, 2);
      assert.deepEqual(installed.cables, ['0,2']);
      assert.equal(installed.budget, 1160);
    });

    it('does not install over obstacles or houses', () => {
      const state = game.initialState();
      assert.equal(game.placeCable(state, 2, 3).cables.length, 0);
      assert.equal(game.placeCable(state, 3, 1).cables.length, 0);
    });

    it('connects a house only after fiber reaches it', () => {
      let state = game.initialState();
      state = game.connectHouse(state, 'h1');
      assert.equal(state.connected.length, 0);
      state = game.placeCable(state, 0, 2);
      state = game.placeCable(state, 1, 2);
      state = game.placeCable(state, 1, 1);
      state = game.placeCable(state, 2, 1);
      state = game.connectHouse(state, 'h1');
      assert.deepEqual(state.connected, ['h1']);
    });

    it('generates revenue only from active connected clients', () => {
      const state = { ...game.initialState(), connected: ['h1', 'h2'], outages: ['h2'] };
      const next = game.advanceDay(state, .9);
      assert.equal(next.revenue, 35);
      assert.equal(next.budget, 1235);
    });

    it('repairs an outage and restores satisfaction', () => {
      const state = { ...game.initialState(), connected: ['h1'], outages: ['h1'] };
      assert.equal(game.satisfaction(state), 0);
      const repaired = game.repairHouse(state, 'h1');
      assert.equal(game.satisfaction(repaired), 100);
      assert.equal(repaired.budget, 1140);
    });
  });
};
