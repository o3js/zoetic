const z = require('../src/index');
const assert = require('chai').assert;
const Promise = require('bluebird');
const fp = require('lodash/fp');


module.exports = [
  ['basics',
   // ['transducer', () => {
   //   assert.deepEqual(t.into([], g.resolve, [1,2,3]), [1,2,3]);
   // }],
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
   // ['map iterator', () => {
   //   return assert.eventually.deepEqual(
   //     z.collect(zt.map(i=>i*2, z.iterator(() => [1, 2, 3]))),
   //     [2, 4, 6]
   //   );
   // }],
   ['iterator and emitter can share a composed transducer', () => {
     const xform = z.comp(
       z.resolve(),
       z.take(3),
       z.map(i => i * 2),
       z.map(i => i - 1));

     const source = fp.map(Promise.resolve, [1, 2, 3, 4, 5]);

     return Promise.all([
       assert.eventually.deepEqual(
         z.collect(z.propagate(xform, z.iterator(() => source))),
         [1, 3, 5]),
       assert.eventually.deepEqual(
         z.collect(z.propagate(xform, z.emitter(source))),
         [1, 3, 5]),
     ]);
   }],
  ],

];
