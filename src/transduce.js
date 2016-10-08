const fp = require('lodash/fp');
const { isEmitter, isIterator, emitter, iterator, bind } = require('./core');
const assert = require('assert');

function reduce(reducer, target, seq) {
  if (isEmitter(target)) {
    target.bind((next, error, complete) => {
      (seq.subscribe)(
        (item) => reducer(forward, item),
        error,
        complete);
    });
  }
  if (isIterator(target)) {
    bind(() => (next, error, complete) => {
      seq.forward(...reducer(next, error, complete));
    }, target);
  } else {
    assert(false, 'Unrecognized sequence type');
  }
  return target;
}

function map(f) {
  return (next, e, c) => [(item) => next(f(item)), e, c];
}

function propagate(xf, seq) {
  return reduce(xf, new seq.constructor(), seq);
};


module.exports = { propagate, map };
