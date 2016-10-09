const z = require('../src/index');
const zt = require('../src/transduce').transducer;
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
   // ['map iterator', () => {
   //   return assert.eventually.deepEqual(
   //     z.collect(zt.map(i=>i*2, z.iterator(() => [1, 2, 3]))),
   //     [2, 4, 6]
   //   );
   // }],
   ['map iterator with transducer', () => {
     return assert.eventually.deepEqual(
       z.collect(z.propagate(
         [z.resolve(),
          z.take(3),
          z.map(i => i * 2),
          z.map(i => i - 1)],
         z.iterator(() => fp.map(Promise.resolve, [1, 2, 3, 4, 5])))),
       [1, 3, 5]
     );
   }],
  ],

];
