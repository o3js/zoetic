const z = require('../src/index');
const zt = require('../src/transduce').transducer;
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
  //  ['resolve promises in order', () => {
  //    return assert.eventually.deepEqual(
  //      z.collect(
  //        z.resolve(
  //          z.emitter(
  //            [1, Promise.delay(10).then(() => 2), 3]))),
  //      [1, 2, 3]);
  //  }],
  // ],
  // ['transducing',
  //  ['transducers have multiple arities', () => {
  //    z.collect(z.map(i => i - 1, z.emitter([1, 2, 3])))
  //      .then((r1) => {
  //        return assert.eventually.deepEqual(
  //          z.collect(z.propagate(z.map(i => i - 1), z.emitter([1, 2, 3]))), r1);
  //      });
  //  }],
  //  ['All transducers support early termination', () => {
  //    return Promise.each(
  //      fp.toPairs(
  //        { map: zt.map(fp.identity),
  //          resolve: zt.resolve(),
  //          tap: zt.tap(fp.noop) }),
  //      fp.spread((name, tducer) => {
  //        let halted = false;
  //        const xf = fp.flow(
  //          z.take(1),
  //          tducer
  //        )({ next: fp.noop, complete: fp.noop });
  //        xf.next(1, () => {
  //          halted = true;
  //        });
  //        return Promise.delay().then(() => {
  //          assert(halted, 'Expected transducer to pass back halt: ' + name);
  //        });
  //      }));
  //  }],
   ['iterator and emitter can share a composed transducer', () => {
     const xform = fp.flowRight(
       z.map(i => i - 1),
       z.map(i => i * 2),
       z.take(3),
       z.resolve()
     );


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
