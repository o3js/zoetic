const fp = require('lodash/fp');
const util = require('./util');
const { reduce, map } = require('./transforms');

function adjoinEmitters(ems) {
  const completed = fp.mapValues(() => false, ems);
  return util.emitter((emit, error, complete, opts) => {
    let tuple = fp.isArray(ems) ? [] : {};
    let allSubscribed = false;
    fp.each((key) => {
      ems[key].subscribe(
        (item) => {
          tuple = fp.clone(tuple);
          tuple[key] = item;
          if (allSubscribed) emit(tuple);
        },
        (err) => {
          error(err);
        },
        () => {
          completed[key] = true;
          if (fp.every(fp.identity, completed)) {
            complete();
          }
        },
        opts);
    }, fp.keys(ems));
    allSubscribed = true;
    // The first emit happens after each adjoined emitter has had a chance
    // to fire synchronously
    emit(tuple);
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
  if (!ems.length) return util.emitter([]);
  return util.emitter((emit, error, complete, opts) => {
    const completed = fp.map(() => false, ems);
    fp.times(i => {
      ems[i].subscribe(
        emit,
        error,
        () => {
          completed[i] = true;
          if (fp.every(fp.identity, completed)) complete();
        },
        opts);
    }, ems.length);
  });
}

// TODO: needs tests, especially for error cases
function lastWith(lastEm, em) {
  return util.emitter((emit, error, complete, opts) => {
    let last;
    lastEm.subscribe((item) => { last = item; }, error, fp.noop, opts);
    em.subscribe((item) => emit([last, item]), error, complete);
  });
}

function reduceAll(...args) {
  const [reducers, initial, ems] = args.length > 2
          ? args
          : [args[0], undefined, args[1]];

  return reduce(
    (last, [idx, val]) => reducers[idx](last, val),
    initial,
    merge(
      ...fp.map(
        i => map(v => [i, v], ems[i]),
        fp.range(0, ems.length))));
}

function props(...args) {
  const em = args.pop();
  return fp.transform(
    (result, prop) => {
      result[prop] = map(prop, em);
      return result;
    },
    {},
    args);
}

module.exports = { adjoin, merge, reduceAll, props, lastWith };
