const transforms = require('./transforms');
const util = require('./util');
const fp = require('lodash/fp');
const Promise = require('bluebird');
const combine = require('./combinations');
const dom = require('./dom');

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
function emitify(fn) {
  return (...args) => {
    return map(
      fp.spread(fn),
      changes(
        combine.adjoin(fp.map(castEmitter, args))));
  };
}

module.exports = fp.extendAll([
  transforms,
  {
    merge: combine.merge,
    collect,
    each,
    flow,
    emitter: util.emitter,
    bind: util.bind,
    callbackFor: util.callbackFor,
    emitify,
    bindel: dom.bindel,
    listen: dom.listen,
  },
]);
