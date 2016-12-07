const transforms = require('./transforms');
const util = require('./util');
const assert = require('assert');
const fp = require('lodash/fp');
const _s = require('o3-sugar');
const Promise = require('bluebird');
const combine = require('./combinations');

function transformToTransformer(xf) {
  const arity = _s.parseParams(xf).length;
  const transformer = (...args) => {
    assert(
      args.length >= arity,
      'Insufficient arguments, expected at least ' + arity);
    if (args.length === arity) {
      return xf(...args);
    }
    return util.emitter(
      xf(...args.slice(0, -1))(util.makeSource(fp.last(args)))
    );
  };
  return transformer;
}

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

const transformers = fp.mapValues(transformToTransformer, transforms);

const { map, changes } = transformers;
function emitify(fn) {
  return (...args) => {
    return map(
      fp.spread(fn),
      changes(
        combine.adjoin(fp.map(castEmitter, args))));
  };
}

function observel(field, eventName, em) {
  return (el, release) => {
    util.bind(
      transformers.observe(
        () => el[field],
        util.listen(eventName)(el, release)),
      em);
  };
}


module.exports = fp.extendAll([
  transformers,
  {
    merge: combine.merge,
    collect,
    each,
    flow,
    emitter: util.emitter,
    bind: util.bind,
    callbackFor: util.callbackFor,
    listen: util.listen,
    emitify,
    observel,
  },
]);
