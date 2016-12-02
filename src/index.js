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
  return em.subscribe(emit_, error, complete);
}

function flow(...args) {
  const source = util.makeSource(fp.last(args));
  return {
    subscribe: fp.flowRight(args.slice(0, -1))(source),
  };
}

const transformers = fp.mapValues(transformToTransformer, transforms);


function observableCast(thing) {
  return (thing && fp.isFunction(thing.current))
    ? thing
    : util.observable(thing, []);
}

const { map, changes } = transformers;
function observer(fn) {
  return (...args) => {
    const obsList = fp.map(observableCast, args);
    return util.observable(
      null,
      map(
        fp.spread(fn),
        changes(
          combine.adjoin(
            fp.map((obs) => obs.current(), obsList),
            obsList))));
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
    observable: util.observable,
    bind: util.bind,
    callbackFor: util.callbackFor,
    observer,
  },
]);
