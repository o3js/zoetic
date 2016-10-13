const _ = require('lodash');
const _s = require('sugar');
const fp = require('lodash/fp');
const assert = require('sugar').assert;
const Promise = require('bluebird');
const { iterator, emitter, each } = require('./core');
const transduce = require('./transduce');

const collect = (seq) => new Promise(
  (resolve, reject) => {
    const items = [];
    each(
      (item) => { items.push(item); },
      (err) => { reject(err); reject = _.noop; },
      () => { resolve(items); },
      seq);
  });

function transducerToOperation(td) {
  const arity = _s.parseParams(td).length;
  const name = td.name;
  const op = (...args) => {
    assert(
      args.length >= arity,
      'Insufficient arguments, expected at least ' + arity);
    if (args.length === arity) {
      return td(...args);
    }
    return transduce.propagate(
      td(...fp.take(arity, args)),
      args[arity]);
  };
  op.name = name;
  return op;
}

const ops = fp.mapValues(transducerToOperation, transduce.transducer);

module.exports = _.extend(
  ops,
  {
    emitter,
    iterator,
    each,
    collect,
    comp: transduce.comp,
    propagate: transduce.propagate,
  }
);
