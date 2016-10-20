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

function reduce(reducer, target, source) {
  const sourceIter =
    isIterator(source) ? source : iterator(() => source);
  const xf = reducer(sourceIter);

  if (isEmitter(target)) {
    bind((emit, emitError, complete) => {
      each(
        emit,
        emitError,
        complete,
        xf);
    }, target);
  } else if (isIterator(target)) {
    bind(() => (result, error, complete) => {
      xf.next(result, error, complete);
    }, target);
  } else {
    assert(false, 'Expected target to be a streamy type');
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

function reject(f) {
  return filter((...args) => !f(...args));
}

function takeNth(n) {
  return (xf) => {
    let skip = 0;
    return filter(() => {
      if (!skip) {
        skip = n - 1;
        return true;
      }
      skip -= 1;
      return false;
    })(xf);
  };
}

function drop(n) {
  return (xf) => {
    let skip = n;
    return filter(() => {
      if (skip) {
        skip -= 1;
        return false;
      }
      return true;
    })(xf);
  };
}

function mapIndexed(f) {
  return (xf) => {
    let curIndex = 0;
    return {
      next: (next, error, complete) => {
        xf.next(
          (item) => next(f(curIndex++, item)),
          error,
          complete);
      } };
  };
}

function _nextIter(state, xf, next, error, complete) {
  xf.next(
    (item) => {
      assertIsStreamy(item);
      state.currentIter = iterator(() => item);
      state.currentIter.next(next, error, () => {
        _nextIter(state, xf, next, error, complete);
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

function bufferedIter(size, input) {
  const items = new Array(size);
  let outBlocked = null;
  let finished = false;
  let rIdx = -1;
  let wIdx = -1;

  function bufIdx(absoluteIdx) {
    return absoluteIdx % size;
  }

  function bufferedItems() {
    return wIdx - rIdx;
  }

  function bufferFull() {
    return size === bufferedItems();
  }

  function writeHandler(type, recur) {
    return (thing) => {
      if (outBlocked) {
        outBlocked[type](thing);
        outBlocked = null;
      } else {
        wIdx += 1;
        const item = {};
        item[type] = thing;
        items[bufIdx(wIdx)] = item;
      }
      if (!bufferFull()) recur(input);
    };
  }

  function write() {
    input.next(
      writeHandler('result', write),
      writeHandler('error', write),
      () => {
        finished = true;
        if (outBlocked) outBlocked.complete();
      }
    );
  }

  return iterator(() => {
    write();
    return (result, error, complete) => {
      assert(!outBlocked);
      if (!bufferedItems() && finished) {
        complete();
        return;
      }
      if (rIdx < wIdx) {
        const bufferWasFull = bufferFull();
        rIdx += 1;
        if (items[bufIdx(rIdx)].result) result(items[bufIdx(rIdx)].result);
        else error(items[bufIdx(rIdx)].error);
        outBlocked = null;
        if (bufferWasFull) {
          write();
        }
      } else {
        outBlocked = { result, error, complete };
      }
    };
  });
}

function buffer(num) {
  return (xf) => bufferedIter(num, xf);
}

function take(count) {
  return (xf) => {
    let remaining = count;
    return {
      next: (result, error, complete) => {
        if (remaining === 0) {
          complete();
          return;
        }
        xf.next(
          (item) => {
            remaining -= 1;
            result(item);
          },
          error,
          complete);
      } };
  };
}

function collect() {
  return (xf) => {
    const items = [];
    let completed = false;
    return {
      next: (result, error, complete) => {
        if (completed) {
          complete();
          return;
        }
        each(
          (item) => { items.push(item); },
          (err) => { if (!completed) { completed = true; error(err); } },
          () => { if (!completed) { completed = true; result(items); } },
          xf);
      } };
  };
}

function partition(num) {
  return (xf) => {
    let completed = false;
    return {
      next: (result, error, complete) => {
        if (completed) {
          complete();
          return;
        }
        collect()(take(num)(xf))
          .next(
            (items) => {
              if (items.length === num) result(items);
              else if (items.length === 0) {
                complete();
              } else if (items.length < num) {
                completed = true;
                result(items);
              }
            },
            error,
            complete);
      } };
  };
}

function propagate(...args) {
  const seq = fp.last(args);
  args.pop();
  const xfs = fp.flowRight(fp.flatten([args]));
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
  reject,
  takeNth,
  drop,
  mapIndexed,
  buffer,
  partition,
  collect,
};

module.exports = { propagate, transducer };
