const z = require('../src/index');
const zt = require('../src/transduce');
const assert = require('chai').assert;
const Promise = require('bluebird');


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
   ['map iterator', () => {
     return assert.eventually.deepEqual(
       z.collect(zt.map(i=>i*2, z.iterator(() => [1, 2, 3]))),
       [2, 4, 6]
     );
   }],
   ['map iterator with transducer', () => {
     return assert.eventually.deepEqual(
       z.collect(zt.map(i=>i*2), z.iterator(() => [1, 2, 3]))),
       [2, 4, 6]
     );
   }],
  ],

];
