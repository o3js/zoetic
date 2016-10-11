const { isEmitter, isIterator, iterator, bind, each } = require('./core');
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
  return (xf) => (result, error, complete) => {
    xf.next(
      (item) => { f(item); result(item); },
      error,
      complete);
  };
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

// function cat() {
//   return ({ next, error, complete }) => {
//     return {
//       next: _.noop,
//     }
//   };
// }

// Unwrap promises and yield them mainting the original
// order of the promises in the seq
function resolve() {
  return (xf) => {
    let completeCalled = false;
    let chain = Promise.resolve();
    let outstanding = 0;
    return {
      next: (result, error, complete) => {
        if (completeCalled) {
          complete();
          return;
        }
        xf.next(
          (item) => {
            outstanding += 1;
            chain = chain
              .then(() => item)
              .catch(error)
              .then((val) => {
                outstanding -= 1;
                result(val);
              });
          },
          error,
          () => {
            completeCalled = true;
            if (!outstanding) {
              complete();
            }
          });
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
  take,
  resolve,
  tap,
  log,
};

module.exports = { propagate, transducer };
