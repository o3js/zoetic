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
   ['stream to iterator', () => {
     return assert.eventually.deepEqual(
       z.collect(z.iterator(() => z.emitter([1, 2, 3]))),
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

   ['transducers have multiple arities', () => {
     z.collect(z.map(i => i - 1, z.emitter([1, 2, 3])))
       .then((r1) => {
         return assert.eventually.deepEqual(
           z.collect(z.propagate(z.map(i => i - 1), z.emitter([1, 2, 3]))), r1);
       });
   }],

   ['cat stream of iterators and emitters', () => {
     return assert.eventually.deepEqual(
       z.collect(
         z.cat(
           z.iterator(() => [
             z.iterator(() => [1, 2, 3]),
             z.iterator(() => [4, 5]),
             z.emitter(['a']),
             z.iterator(() => [6]),
           ]))),
       [1, 2, 3, 4, 5, 'a', 6]);
   }],

   ['mapcat', () => {
     return assert.eventually.deepEqual(
       z.collect(
         z.mapcat(
           (num) => {
             return z.emitter((next, error, complete) => {
               fp.times(() => { next(num); }, num);
               complete();
             });
           },
           z.emitter([1, 2, 3]))),
       [1, 2, 2, 3, 3, 3]);
   }],

   ['iterator and emitter can share a composed transducer', () => {
     const xform = fp.flow(
       z.resolve(),
       z.take(3),
       z.mapcat(
         (num) => {
           return z.emitter((next, error, complete) => {
             fp.times(() => { next(num); }, num);
             complete();
           });
         }),
       z.map(i => i * 2)
     );
     const source = () => fp.map(Promise.resolve, [1, 2, 3, 4, 5]);

     return Promise.all([
       assert.eventually.deepEqual(
         z.collect(z.propagate(xform, z.iterator(source))),
         [2, 4, 4, 6, 6, 6]),
       assert.eventually.deepEqual(
         z.collect(z.propagate(xform, z.emitter(source()))),
         [2, 4, 4, 6, 6, 6]),
     ]);
   }],
  ],

];
