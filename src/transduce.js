const fp = require('lodash/fp');
const { isEmitter, isIterator, emitter, iterator, bind } = require('./core');
const assert = require('assert');

function reduce(reducer, target, seq) {
  if (isEmitter(target)) {
    bind((next, error, complete) => {
      seq.subscribe(...reducer(next, error, complete));
    }, target);
  } else if (isIterator(target)) {
    // Reducer can only be called once, but for an iterator, the
    // bound source is called once per element, so we need to call
    // the reducer outside the bind call.
    let n;
    let e;
    let c;
    const r = reducer(i => n(i), err => e(err), () => c());
    bind(() => (next, error, complete) => {
      n = next; e = error; c = complete;
      seq.forward(i => r[0](i), err => r[1](err), () => r[2]());
    }, target);
  } else {
    assert(false, 'Unrecognized sequence type');
  }
  return target;
}

function tap(f) {
  return (next, e, c) => [(item) => { f(item); next(item); }, e, c];
}

function log(label) {
  return tap((item) => { console.log(label + ': ', item); });
}

function map(f) {
  return (next, e, c) => [(item) => next(f(item)), e, c];
}

function resolve() {
  return (next, error, complete) => {
    let completeCalled = false;
    let outstanding = 0;
    return [
      (item) => {
        outstanding += 1;
        Promise.resolve(item).then((val) => {
          next(val);
          if (completeCalled && !outstanding) complete();
        }, error);
      },
      error,
      () => { completeCalled = true; if (!outstanding) complete(); },
    ];
  };
}

function take(count) {
  return (next, e, complete) => {
    let remaining = count;
    return [
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
  };
}

function comp(...xfs) {
  return (next, error, complete) => {
    return xfs[1]
      ? xfs[0](...comp(...fp.tail(xfs))(next, error, complete))
      : xfs[0](next, error, complete);
  };
}

function propagate(xfs, seq) {
  return reduce(
    comp(...(fp.isArray(xfs) ? xfs : [xfs])),
    new seq.constructor(),
    seq);
}

const transducer = {
  map,
  take,
  resolve,
  tap,
  log,
};

module.exports = { propagate, comp, transducer };
