const z = require('../src/index');
const assert = require('chai').assert;
const Promise = require('bluebird');
const fp = require('lodash/fp');


module.exports = [
  ['basics',
   ['collect iterator', () => {
     return assert.eventually.deepEqual(
       z.collect(z.iterator(() => [1, 2, 3])),
       [1, 2, 3]);
   }],
   ['collect emitter', () => {
     return assert.eventually.deepEqual(
       z.collect(z.emitter([1, 2, 3])),
       [1, 2, 3]);
   }],
   ['resolve promises in order', () => {
     return assert.eventually.deepEqual(
       z.collect(
         z.resolve(
           z.emitter(
             [1, Promise.delay(10).then(() => 2), 3]))),
       [1, 2, 3]);
   }],
  ],
  ['transducing',
   ['iterator and emitter can share a composed transducer', () => {
     const xform = z.comp(
       z.resolve(),
       z.take(3),
       z.map(i => i * 2),
       z.map(i => i - 1));

     const source = () => fp.map(Promise.resolve, [1, 2, 3, 4, 5]);

     return Promise.all([
       assert.eventually.deepEqual(
         z.collect(z.propagate(xform, z.iterator(source))),
         [1, 3, 5]),
       assert.eventually.deepEqual(
         z.collect(z.propagate(xform, z.emitter(source()))),
         [1, 3, 5]),
     ]);
   }],
  ],

];
