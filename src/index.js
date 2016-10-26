const _ = require('lodash');
const _s = require('o3-sugar');
const fp = require('lodash/fp');
const { iterator, emitter, each } = require('./core');
const transduce = require('./transduce');
const Promise = require('bluebird');

const assert = _s.assert;

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

const collected = (seq) => {
  return new Promise(
    (resolve, reject) => {
      each(
        resolve,
        reject,
        () => {},
        ops.take(1, ops.collect(seq)));
    });
};

module.exports = _.extend(
  ops,
  {
    emitter,
    iterator,
    each,
    collected,
    comp: transduce.comp,
    propagate: transduce.propagate,
  }
);
