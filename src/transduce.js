const fp = require('lodash/fp');
const { isEmitter, isIterator, emitter, iterator, bind } = require('./core');
const assert = require('assert');
const Promise = require('bluebird');

function reduce(reducer, target, seq) {
  if (isEmitter(target)) {
    bind((next, error, complete) => {
      const r = reducer({ next, error, complete });
      let unsubscribe = null;
      unsubscribe = seq.subscribe(
        (item) => { r.next(item, unsubscribe); },
        r.error,
        r.complete);
    }, target);
  } else if (isIterator(target)) {
    // Reducer can only be called once, but for an iterator, the
    // bound source is called once per element, so we need to call
    // the reducer outside the bind call.
    const xf = { n: null, e: null, c: null };
    const r = reducer({
      next: i => xf.n(i), error: err => xf.e(err), complete: () => xf.c() });
    bind(() => (next, error, complete) => {
      xf.n = next; xf.e = error; xf.c = complete;
      seq.forward(i => r.next(i), err => r.error(err), () => r.complete());
    }, target);
  } else {
    assert(false, 'Unrecognized sequence type');
  }
  return target;
}

function tap(f) {
  return ({ next, error, complete }) => ({
    next: (item, halt) => { f(item); next(item, halt); },
    error,
    complete,
  });
}

function log(label) {
  return tap((item) => { console.log(label + ': ', item); });
}

function map(f) {
  return ({ next, error, complete }) => ({
    next: (item, halt) => next(f(item), halt),
    error,
    complete,
  });
}

// Unwrap promises and yield them mainting the original
// order of the promises in the seq
function resolve() {
  return ({ next, error, complete }) => {
    let completeCalled = false;
    let chain = Promise.resolve();
    let outstanding = 0;
    let halted = false;
    return {
      next: (item, halt) => {
        outstanding += 1;
        chain = chain
          .then(() => item)
          .catch(error)
          .then((val) => {
            outstanding -= 1;
            !halted && next(val, () => {
              chain.cancel();
              halted = true;
            }, halt);
            if (!halted && completeCalled && !outstanding) {
              complete();
              complete = fp.noop;
            }
          });
      },
      error,
      complete: () => {
        completeCalled = true;
        if (!outstanding) {
          complete();
        }
      },
    };
  };
}

function take(count) {
  return ({ next, error, complete }) => {
    let remaining = count;
    return {
      next: (item, halt) => {
        if (remaining === 0) {
          complete(); halt();
        } else {
          remaining -= 1;
          next(item, halt);
        }
      },
      error,
      complete,
    };
  };
}

function comp(...xfs) {
  return (handlers) => {
    return xfs[1]
      ? xfs[0](comp(...fp.tail(xfs))(handlers))
      : xfs[0](handlers);
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
