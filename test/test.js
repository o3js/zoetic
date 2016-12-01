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
      z.bind(em, [1, 2, 3]);
      return test;
    }],
   ],
   ['transforms',
    ['map', () => {
      return assertCollected(
        z.map((i) => i * 2, z.emitter([1, 2, 3])),
        [2, 4, 6]);
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
     const o = z.observable(1, z.emitter([2, 3]));
     return Promise.all([
       assertCollected(z.observable(1, z.emitter([2, 3])), [3]),
       assertCollected(o, [3]),
       assertCollected(o, [3]),
     ]);
   }],
   ['observe a function\'s result', () => {
     return assertCollected(
       z.observe(
         (a, b, c) => a + b + c,
         z.observable(1, []),
         z.observable(2, []),
         3),
       [6]);
   }],
  ],
];
