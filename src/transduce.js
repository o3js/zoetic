const fp = require('lodash/fp');
const { isEmitter, isIterator, emitter, iterator, bind } = require('./core');
const assert = require('assert');

function reduce(reducer, target, iter) {
  if (isEmitter(target)) {
    target.bind((forward, error, complete) => {
      (iter.subscribe)(
        (item) => reducer(forward, item),
        error,
        complete);
    });
  }
  if (isIterator(target)) {
    bind(() => (forward, error, complete) => {
      (iter.forward)(
        (item) => reducer(forward, item),
        error,
        complete);
    }, target);
  } else {
    assert(false, 'Unrecognized sequence type');
  }
  return target;
}

function map(fn, iter) {
  return reduce(
    (forward, item) => {
      forward(fn(item));
    },
    iterator(),
    iter);
}

module.exports = { map };
