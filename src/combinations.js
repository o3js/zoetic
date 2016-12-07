const fp = require('lodash/fp');
const util = require('./util');
const assert = require('o3-sugar').assert;

function unsubAll(unsubs) {
  fp.each(unsub => unsub(), unsubs);
}

function unsubAllValues(unsubs) {
  fp.each(unsub => unsub(), unsubs);
}

function adjoinEmitters(ems) {
  const completed = fp.mapValues(() => false, ems);
  return util.emitter((emit, error, complete) => {
    let tuple = fp.isArray(ems) ? [] : {};
    const unsubs = {};
    const _unsubAll = fp.partial(unsubAllValues, [unsubs]);
    let allSubscribed = false;
    fp.each((key) => {
      ems[key].subscribe(
        (item, unsub) => {
          unsubs[key] = unsub;
          tuple = fp.clone(tuple);
          tuple[key] = item;
          if (allSubscribed) emit(tuple, _unsubAll);
        },
        (err, unsub) => {
          unsubs[key] = unsub;
          error(err, _unsubAll);
        },
        () => {
          completed[key] = true;
          if (fp.every(fp.identity, completed)) {
            complete();
          }
        });
    }, fp.keys(ems));
    allSubscribed = true;
    // The first emit happens after each adjoined emitter has had a chance
    // to fire synchronously
    emit(tuple, _unsubAll);
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

function adjoin(ems) {
  util.assertEmitterArray(ems);
  return adjoinEmitters(ems);
}

function merge(...ems) {
  return util.emitter((emit, error, complete) => {
    const completed = fp.map(() => false, ems);
    const unsubs = [];
    const _unsubAll = fp.partial(unsubAll, [unsubs]);
    fp.times(i => {
      ems[i].subscribe(
        (item, unsub) => {
          unsubs[i] = unsub;
          emit(item, _unsubAll);
        },
        (err, unsub) => {
          unsubs[i] = unsub;
          error(err, _unsubAll);
        },
        () => {
          completed[i] = true;
          if (fp.every(fp.identity, completed)) complete();
        });
    }, ems.length);
  });
}

module.exports = { adjoin, merge };
