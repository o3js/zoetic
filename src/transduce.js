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

function resolve() {
  return (next, error, c) => [
    (item) => Promise.resolve(item).then(next, error),
    error,
    c,
  ];
}

function take(count) {
  let remaining = count;
  return (next, e, complete) => [
    (item) => {
      if (remaining === 0) complete();
      else {
        remaining -= 1;
        next(item);
      }
    },
    e,
    complete,
  ];
}

function comp(...xfs) {
  return (next, error, complete) => {
    return xfs[1]
      ? xfs[0](...comp(...fp.tail(xfs))(next, error, complete))
      : xfs[0](next, error, complete);
  };
}

function propagate(xfs, seq) {
  return reduce(comp(...xfs), new seq.constructor(), seq);
};

const transducer = {
  map,
  comp,
  take,
  resolve,
};

module.exports = { propagate, transducer };
