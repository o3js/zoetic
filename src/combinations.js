const fp = require('lodash/fp');
const util = require('./util');
const assert = require('o3-sugar').assert;

function adjoinEmitters(tuple, ems) {
  const completed = fp.map(() => false, ems);
  return util.emitter((next, error, complete) => {
    let i = -1;
    fp.each((em) => {
      i += 1;
      em.subscribe(
        (item) => {
          tuple = fp.clone(tuple);
          tuple[i] = item;
          next(tuple);
        },
        error,
        () => {
          completed[i] = true;
          if (fp.every(fp.identity, completed)) {
            complete();
          }
        });
    }, ems);
  });
}

function adjoinProps(defaults, ems) {
  util.assertEmitterProps(ems);
  if (defaults) assert(fp.isPlainObject(defaults),
                       'adjoinProps takes object of defaults');
  defaults = defaults || fp.mapValues(fp.noop, ems);
  ems = fp.mapValues(
    (val, key) => (
      fp.isEmitter(val) ? val : adjoinProps(val, defaults && defaults[key])),
    ems);
  return adjoinEmitters(defaults, ems);
}

function adjoin(defaults, ems) {
  defaults = defaults || fp.map(fp.noop, ems);
  util.assertEmitterArray(ems);

  if (defaults) assert(fp.isArray(defaults),
                       'adjoin takes an array of defaults');
  return adjoinEmitters(defaults, ems);
}

module.exports = { adjoin, adjoinProps };
