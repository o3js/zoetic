const transforms = require('./transforms');
const util = require('./util');
const fp = require('lodash/fp');
const Promise = require('bluebird');
const combinations = require('./combinations');
const dom = require('./dom');
const Sink = require('./sink');

function collect(em) {
  return new Promise((resolve, reject) => {
    const results = [];
    em.subscribe(
      (item) => results.push(item),
      reject,
      () => resolve(results),
      { onHalt: fp.noop });
  });
}

function each(...args) {
  const em = args.pop();
  const [emit, error, complete] = args;
  return em.subscribe(emit || fp.noop, error || fp.noop, complete || fp.noop);
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
      combinations.adjoin(fp.map(castEmitter, args))));
}

function observable(initial, em = util.emitter([])) {
  return new Sink(
    transforms.changes(
      transforms.startWith(initial, em)));
}

function sink(...args) {
  if (args.length === 1) return new Sink(args[0]);
  return new Sink(combinations.merge(...args));
}

module.exports = fp.extendAll([
  transforms,
  {
    merge: combinations.merge,
    reduceAll: combinations.reduceAll,
    props: combinations.props,
    lastWith: combinations.lastWith,
    collect,
    each,
    flow,
    apply,
    observable,
    sink,
    emitter: util.emitter,
    bind: util.bind,
    callbackFor: util.callbackFor,
    bindel: dom.bindel,
    listen: dom.listen,
  },
]);
