const {
  isEmitter,
  isIterator,
  assertIsStreamy,
  iterator,
  bind,
  each,
} = require('./core');
const fp = require('lodash/fp');
const assert = require('assert');
const Promise = require('bluebird');

function reduce(reducer, target, seq) {
  if (isEmitter(target)) {
    bind((emit, emitError, complete) => {
      each(
        emit,
        emitError,
        complete,
        reducer(iterator(() => seq)));
    }, target);
  } else if (isIterator(target)) {
    const xf = reducer(seq);
    bind(() => (result, error, complete) => {
      xf.next(result, error, complete);
    }, target);
  } else {
    assert(false, 'Unrecognized sequence type');
  }
  return target;
}

function tap(f) {
  return (xf) => ({
    next: (result, error, complete) => xf.next(
      (item) => { f(item); result(item); },
      error,
      complete),
  });
}

function log(label) {
  // eslint-disable-next-line no-console
  return tap((item) => { console.log(label + ': ', item); });
}

function map(f) {
  return (xf) => ({
    next: (result, error, complete) => {
      return xf.next(
        (item) => result(f(item)),
        error,
        complete);
    } });
}

function filter(f) {
  return (xf) => ({
    next: (result, error, complete) => {
      function untilFound() {
        xf.next(
          (item) => {
            if (fp.iteratee(f)(item)) result(item);
            else untilFound();
          },
          error,
          complete);
      }
      untilFound();
    } });
}

function _nextIter(state, xf, next, error, complete) {
  xf.next(
    (item) => {
      assertIsStreamy(item);
      state.currentIter = iterator(() => item);
      state.currentIter.next(next, error, () => {
        _nextIter();
      });
    },
    error,
    complete);
}

function cat() {
  return (xf) => {
    const state = {};
    return {
      next: (next, error, complete) => {
        if (state.currentIter) {
          state.currentIter.next(next, error, () => {
            _nextIter(state, xf, next, error, complete);
          });
        } else {
          _nextIter(state, xf, next, error, complete);
        }
      } };
  };
}

function mapcat(f) {
  return fp.flow(map(f), cat());
}

// Unwrap promises and yield them mainting the original
// order of the promises in the seq
function resolve() {
  return (xf) => {
    return {
      next: (result, error, complete) => {
        xf.next(
          (item) => { Promise.resolve(item).then(result, error); },
          error,
          complete);
      },
    };
  };
}

function take(count) {
  return (xf) => {
    let remaining = count;
    return {
      next: (result, error, complete) => {
        xf.next(
          (item) => {
            if (remaining === 0) {
              complete();
            } else {
              remaining -= 1;
              result(item);
            }
          },
          error,
          complete);
      } };
  };
}

function propagate(xfs, seq) {
  return reduce(xfs, new seq.constructor(), seq);
}

const transducer = {
  map,
  cat,
  mapcat,
  take,
  resolve,
  tap,
  log,
  filter,
};

module.exports = { propagate, transducer };
