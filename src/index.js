const transforms = require('./transforms');
const util = require('./util');
const fp = require('lodash/fp');
const Promise = require('bluebird');
const combine = require('./combinations');
const dom = require('./dom');
const Observable = require('./observable');

function collect(em) {
  return new Promise((resolve, reject) => {
    const results = [];
    em.subscribe(
      (item) => results.push(item),
      reject,
      () => resolve(results));
  });
}

function each(emit_, error, complete, em) {
  if (arguments.length === 2) {
    // eslint-disable-next-line prefer-rest-params
    return arguments[1].subscribe(emit_, fp.noop, fp.noop);
  }
  return em.subscribe(emit_, error, complete);
}

function flow(...args) {
  const source = util.makeSource(fp.last(args));
  return {
    subscribe: fp.flowRight(args.slice(0, -1))(source),
  };
}

function castEmitter(val) {
  if (fp.isFunction(val.subscribe)) return val;
  return util.emitter([val]);
}

const { map, changes } = transforms;
function apply(fn, ...args) {
  return map(
    fp.spread(fn),
    changes(
      combine.adjoin(fp.map(castEmitter, args))));
}

function observable(...args) {
  const [initial, em] = args.length > 1
          ? args
          : [undefined, args[0]];
  return new Observable(initial, em);
}

module.exports = fp.extendAll([
  transforms,
  {
    merge: combine.merge,
    reduceAll: combine.reduceAll,
    collect,
    each,
    flow,
    apply,
    observable,
    emitter: util.emitter,
    bind: util.bind,
    callbackFor: util.callbackFor,
    bindel: dom.bindel,
    listen: dom.listen,
  },
]);
