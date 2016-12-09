const Promise = require('bluebird');

Promise.config({
  longStackTraces: true,
});

const z = require('../src/index');
const assert = require('chai').assert;

function assertCollected(emitter, expected) {
  return assert.eventually.deepEqual(z.collect(emitter), expected);
}

module.exports = [
  ['Emitter',
   ['multiple subscribers get same thing',
    ['array', () => {
      const em = z.emitter([1, 2, 3]);
      return Promise.all([
        assertCollected(em, [1, 2, 3]),
        assertCollected(em, [1, 2, 3]),
      ]);
    }],
    ['promise', () => {
      const em = z.emitter(Promise.resolve(1));
      return Promise.all([
        assertCollected(em, [1]),
        Promise.delay(10).then(() => {
          return assertCollected(em, [1]);
        }),
      ]);
    }],
    ['take', () => {
      const em = z.take(1, z.emitter([1, 2, 3]));
      return Promise.all([
        assertCollected(em, [1]),
        assertCollected(em, [1]),
      ]);
    }],
   ],
   ['drivers',
    ['collect', () => {
      return assert.eventually.deepEqual(
        z.collect(z.emitter([1, 2, 3])), [1, 2, 3]);
    }],
    ['each', () => {
      return assert.eventually.deepEqual(
        new Promise((resolve) => {
          const results = [];
          z.each(
            (item) => results.push(item),
            () => {},
            () => resolve(results),
            z.emitter([1, 2, 3]));
        }),
        [1, 2, 3]);
    }],
   ],
   ['binding',
    ['late', () => {
      const em = z.emitter();
      const test = assert.eventually.deepEqual(
        z.collect(z.emitter([1, 2, 3])), [1, 2, 3]);
      z.bind([1, 2, 3], em);
      return test;
    }],
   ],
   ['transforms',
    ['map', () => {
      return assertCollected(
        z.map((i) => i * 2, z.emitter([1, 2, 3])),
        [2, 4, 6]);
    }],
    ['filter', () => {
      return assertCollected(
        z.filter((i) => {
          return i % 2 === 0;
        }, z.emitter([1, 2, 3, 4])),
        [2, 4]);
    }],
    ['take', () => {
      return assertCollected(
        z.take(2, z.emitter([1, 2])),
        [1, 2]);
    }],
    ['resolve promises in order', () => {
      return assertCollected(
        z.resolve(
          z.emitter(
            [1, Promise.delay(10).then(() => 2), 3])),
        [1, 2, 3]);
    }],
   ['latest', () => {
     return assertCollected(
       z.latest(2, z.emitter([0, 1, 2])),
       [[0, 1], [1, 2]]);
   }],
    ['auto cast to emitter', () => {
      return assertCollected(
        z.map((i) => i * 2, [1, 2, 3]),
        [2, 4, 6]);
    }],
    ['debounce', () => {
      return assertCollected(
        z.debounce(
          50,
          z.resolve(
            z.emitter([
              Promise.delay(1).then(() => 1),
              Promise.delay(10).then(() => 2),
              Promise.delay(100).then(() => 3),
              Promise.delay(110).then(() => 4),
              Promise.delay(120).then(() => 5),
            ]))),
        [2, 5]);
    }],
   ],
   ['combining',
    ['merge', () => {
      return assertCollected(
        z.merge(z.emitter([1, 2]), z.emitter([3, 4])),
        [1, 2, 3, 4]);
    }],
   ],
   ['flow',
    ['basic', () => {
      return assertCollected(
        z.flow(
          z.map(i => i * 2),
          z.map(i => i * 2),
          z.emitter([1, 2, 3])),
        [4, 8, 12]);
    }],
    ['long', () => {
      return assertCollected(
        z.flow(
          z.map(i => i * 2),
          z.take(2),
          z.resolve(),
          z.emitter([Promise.delay(10).then(() => 1), 2, 3])),
        [2, 4]);
    }],
   ],
  ],
  ['Observable',
   ['retains value', () => {
     const data = [1, 2, 3];
     const fn = (val) => val || data[0];
     const o = z.observe(fn, z.emitter(data));
     return Promise.all([
       assertCollected(z.observe(fn, z.emitter(data)), [1, 2, 3]),
       assertCollected(o, [1, 2, 3]),
       assertCollected(o, [1, 2, 3]),
     ]);
   }],
   ['observe a function\'s result', () => {
     return assertCollected(
       z.apply(
         (a, b, c) => a + b + c,
         z.emitter([1]),
         2,
         z.emitter([3])),
       [6]);
   }],
   ['multiple observers', () => {
     const em = z.emitter();
     const emCB = z.callbackFor(em);
     const obs = z.observe((val) => val || 1, em);
     setTimeout(() => {
       emCB(4);
     }, 100);
     assertCollected(obs, [1, 4]);
     assertCollected(obs, [1, 4]);
   }],
  ],
];
