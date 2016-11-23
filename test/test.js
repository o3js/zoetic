const Promise = require('bluebird');

Promise.config({
  longStackTraces: true,
});

const z = require('../src/index');
const assert = require('chai').assert;
const fp = require('lodash/fp');


module.exports = [
  ['basics',
   ['collect iterator', () => {
     return assert.eventually.deepEqual(
       z.collected(z.iterator(() => [1, 2, 3])),
       [1, 2, 3]);
   }],
   ['collect emitter', () => {
     return assert.eventually.deepEqual(
       z.collected(z.emitter([1, 2, 3])),
       [1, 2, 3]);
   }],
   ['emit error', () => {
     return assert.isRejected(
       z.collected(
         z.emitter(Promise.try(() => {
           throw new Error('fail');
         }))));
   }],
   ['stream to iterator', () => {
     return assert.eventually.deepEqual(
       z.collected(z.iterator(() => z.emitter([1, 2, 3]))),
       [1, 2, 3]);
   }],
   ['resolve promises in order', () => {
     return assert.eventually.deepEqual(
       z.collected(
         z.resolve(
           z.emitter(
             [1, Promise.delay(10).then(() => 2), 3]))),
       [1, 2, 3]);
   }],
  ],

  ['transducing',

   ['transducers have multiple arities', () => {
     z.collected(z.map(i => i - 1, z.emitter([1, 2, 3])))
       .then((r1) => {
         return assert.eventually.deepEqual(
           z.collected(
             z.propagate(z.map(i => i - 1), z.emitter([1, 2, 3]))), r1);
       });
   }],

   ['cat stream of iterators and emitters', () => {
     return assert.eventually.deepEqual(
       z.collected(
         z.cat(
           z.iterator(() => [
             z.iterator(() => [1, 2, 3]),
             z.iterator(() => [4, 5]),
             z.emitter(['a']),
             z.iterator(() => [6]),
           ]))),
       [1, 2, 3, 4, 5, 'a', 6]);
   }],

   ['catting empty streams', () => {
     return assert.eventually.deepEqual(
       z.collected(
         z.cat(
           z.iterator(() => [
             z.iterator(() => []),
             z.iterator(() => []),
             z.emitter([]),
           ]))),
       []);
   }],

   ['mapcat', () => {
     return assert.eventually.deepEqual(
       z.collected(
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

   ['filter', () => {
     return assert.eventually.deepEqual(
       z.collected(
         z.filter(i => i < 3, z.emitter([1, 2, 3, 4]))),
       [1, 2]);
   }],

   ['take',
    ['bugfix: take doesn\'t discard anything', () => {
      const items = z.iterator(() => [0, 1, 2, 3, 4, 5]);
      return assert.eventually.deepEqual(
        z.collected(z.take(2, items)),
        [0, 1])
        .then(() => {
          return assert.eventually.deepEqual(
            z.collected(z.take(2, items)),
            [2, 3]);
        });
    }],
   ],

   ['latest',
    ['basics', () => {
      const items = z.emitter([0, 1, 2]);
      return assert.eventually.deepEqual(
        z.collected(z.latest(2, items)),
        [[0, 1], [1, 2]]);
    }]],

   ['startWith',
    ['basics', () => {
      const items = z.startWith(0, z.emitter([1, 2]));
      return assert.eventually.deepEqual(
        z.collected(items),
        [0, 1, 2]);
    }]],

   ['merge',
    ['basics', () => {
      const items = z.merge(z.emitter([1, 2]), z.emitter([3, 4]));
      return assert.eventually.deepEqual(
        z.collected(items),
        [1, 2, 3, 4]);
    }]],

   ['iterator',
    ['bugfix: error on init doesn\'t bust iterator', () => {
      const errorIter = z.iterator(Promise.reject('error'));

      return assert.eventually.equal(
        new Promise((resolve) => {
          z.each(
            fp.noop,
            fp.noop,
            () => { resolve(true); },
            errorIter);
        }),
        true);
    }],
   ],
   ['buffer',
    ['bugfix: error doesn\'t break iterator contract', () => {
      const errorIter = z.iterator(Promise.reject('error'));

      // With the bug, the iterator would stop wirking if the buffer
      // hit an error. It should emit the error, but continue;
      const errorWhenBuffering = z.propagate(
        z.buffer(10),
        z.cat(),
        z.iterator(() => {
          return [
            z.emitter([1, 2, 3]),
            errorIter,
            z.emitter([4, 5, 6])];
        }));
      let last;
      return assert.eventually.equal(
        new Promise((resolve) => {
          z.each(
            (item) => { last = item; },
            fp.noop,
            () => { resolve(last); },
            errorWhenBuffering);
        }),
        6);
    }],
   ],

   ['takeNth', () => {
     return assert.eventually.deepEqual(
       z.collected(
         z.takeNth(2, z.emitter([0, 1, 2, 3, 4, 5]))),
       [0, 2, 4]);
   }],

   ['drop', () => {
     return assert.eventually.deepEqual(
       z.collected(
         z.drop(2, z.emitter([0, 1, 2, 3, 4, 5]))),
       [2, 3, 4, 5]);
   }],

   ['mapIndexed', () => {
     return assert.eventually.deepEqual(
       z.collected(
         z.mapIndexed((i, v) => [i, v], z.emitter(['a', 'b', 'c']))),
       [[0, 'a'], [1, 'b'], [2, 'c']]);
   }],

   ['partition', () => {
     return assert.eventually.deepEqual(
       z.collected(
         z.partition(2, z.iterator(() => [1, 2, 3, 4, 5, 6]))),
       [[1, 2], [3, 4], [5, 6]]);
   }],

   ['partition incomplete', () => {
     return assert.eventually.deepEqual(
       z.collected(
         z.partition(2, z.iterator(() => [1, 2, 3, 4, 5]))),
       [[1, 2], [3, 4], [5]]);
   }],

   ['collect', () => {
     return assert.eventually.deepEqual(
       z.collected(
         z.collect(z.iterator(() => [1, 2, 3]))),
       [[1, 2, 3]]);
   }],

   ['iterator and emitter can share a composed transducer', () => {
     const xform = fp.flow(
       z.resolve(),
       z.buffer(2),
       z.take(3),
       z.mapcat(
         (num) => {
           return z.emitter((next, error, complete) => {
             fp.times(() => { next(num); }, num);
             complete();
           });
         }),
       z.map(i => i * 2),
       z.filter(i => i % 4)
     );
     const source = () => fp.map(Promise.resolve, [1, 2, 3, 4, 5]);

     return Promise.all([
       assert.eventually.deepEqual(
         z.collected(z.propagate(xform, z.iterator(source))),
         [2, 6, 6, 6]),
       assert.eventually.deepEqual(
         z.collected(z.propagate(xform, z.emitter(source()))),
         [2, 6, 6, 6]),
     ]);
   }],
  ],

];
