const fp = require('lodash/fp');
const util = require('./util');
const assert = require('o3-sugar').assert;

function adjoinEmitters(tuple, ems) {
  const completed = fp.mapValues(() => false, ems);
  return util.emitter((next, error, complete) => {
    fp.each((key) => {
      ems[key].subscribe(
        (item) => {
          tuple = fp.clone(tuple);
          tuple[key] = item;
          next(tuple);
        },
        error,
        () => {
          completed[key] = true;
          if (fp.every(fp.identity, completed)) {
            complete();
          }
        });
    }, fp.keys(ems));
  });
}

//
// There's a bug: fp.mapValues does not pass keys through
// function adjoinProps(defaults, ems) {
//   util.assertEmitterProps(ems);
//   if (defaults) assert(fp.isPlainObject(defaults),
//                        'adjoinProps takes object of defaults');
//   defaults = defaults || fp.mapValues(fp.noop, ems);
//   ems = fp.mapValues(
//     (val, key) => (
//       fp.isEmitter(val) ? val : adjoinProps(val, defaults && defaults[key])),
//     ems);
//   return adjoinEmitters(defaults, ems);
// }

function adjoin(defaults, ems) {
  defaults = defaults || fp.map(fp.noop, ems);
  util.assertEmitterArray(ems);

  if (defaults) assert(fp.isArray(defaults),
                       'adjoin takes an array of defaults');
  return adjoinEmitters(defaults, ems);
}

function merge(...ems) {
  return util.emitter((emit, error, complete) => {
    const completed = fp.map(() => false, ems);
    let i = -1;
    fp.each((em) => {
      i += 1;
      em.subscribe(emit, error, () => {
        completed[i] = true;
        if (fp.every(fp.identity, completed)) complete();
      }, em);
    }, ems);
  });
}

module.exports = { adjoin, merge };
