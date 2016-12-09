const _s = require('o3-sugar');
const assert = require('o3-sugar').assert;
const util = require('./util');
const fp = require('lodash/fp');
const Promise = require('bluebird');

function map(fn) {
  return (source) => (emit, error, complete) => {
    source(
      // wasteful array boxing, but the idea is to use the lodash
      // implementation
      (item, unsub) => { emit(fn(item), unsub); },
      error,
      complete);
  };
}

function filter(predicate) {
  return (source) => (emit, error, complete) => {
    return source(
      (item) => {
        if (fp.filter(predicate, [item]).length > 0) emit(item);
      },
      error,
      complete);
  };
}

function take(count) {
  return (source) => {
    return (emit, error, complete) => {
      let remaining = count;
      if (remaining === 0) {
        complete();
      }
      source(
        (val, unsub) => {
          if (!remaining) return;
          remaining--;
          emit(val, unsub);
          if (remaining === 0) {
            complete();
            complete = fp.noop;
            unsub();
            return;
          }
        },
        error,
        complete);
    };
  };
}

function latest(count) {
  return (source) => {
    return (emit, error, complete) => {
      const buffered = [];
      source(
        (item, unsub) => {
          buffered.push(item);
          if (buffered.length > count) buffered.shift();
          if (buffered.length === count) emit(fp.clone(buffered), unsub);
        },
        error,
        complete);
    };
  };
}

function startWith(value) {
  return (source) => {
    return (emit, error, complete) => {
      emit(value);
      source(emit, error, complete);
    };
  };
}

function changes() {
  return (source) => {
    return (emit, error, complete) => {
      const last = [];
      source(
        (item, unsub) => {
          if (last.length && fp.equals(last[0], item)) return;
          last[0] = item;
          emit(item, unsub);
        },
        error,
        complete);
    };
  };
}

function observe(fn) {
  return (source) => {
    return (emit, error, complete) => {
      fp.flowRight(
        changes(),
        startWith(fn()),
        map(fn)
      )(source)(emit, error, complete);
    };
  };
}

function reduce(reducer, initial) {
  return (source) => {
    return (emit, error, complete) => {
      let last = initial;
      let unsubbed = false;
      emit(initial, () => { unsubbed = true; });
      if (unsubbed) return;
      source(
        (item, unsub) => {
          if (unsubbed) {
            unsub();
            return;
          }
          last = reducer(last, item);
          emit(last, unsub);
        },
        (err, unsub) => {
          if (unsubbed) {
            unsub();
            return;
          }
          error(err, unsub);
        }, complete);
    };
  };
}

function debounce(ms) {
  return (source) => {
    return (next, error, complete) => {
      let myTimeout;
      let flushed;
      let completed;
      source(
        (item, unsub) => {
          flushed = false;
          if (myTimeout) clearTimeout(myTimeout);
          myTimeout = setTimeout(() => {
            next(item, unsub);
            flushed = true;
            if (completed) complete();
          }, ms);
        },
        error,
        () => {
          completed = true;
          if (flushed) complete();
        });
    };
  };
}

function tap(fn) {
  return (source) => (emit, error, complete) => {
    source(
      (item, unsub) => {
        fn(item); emit(item, unsub);
      },
      error, complete);
  };
}

function log(label) {
  label |= '';
  // eslint-disable-next-line no-console
  return tap((item) => { console.log(label, item); });
}

// Unsubscribe should halt emitting. this adds quite a bit of noise to the
// implementation -- perhaps there is a better way or it is not worth it.
function resolve() {
  return (source) => {
    return (emit, error, complete) => {
      let pending = Promise.resolve();
      source(
        (val, unsub) => {
          function wrappedUnsub() {
            emit = error = complete = fp.noop;
            unsub();
          }
          pending = pending.then(
            () => {
              return Promise.resolve(val)
                .then((item) => emit(item, wrappedUnsub),
                      (err) => error(err, wrappedUnsub));
            }
          );
        },

        (err, unsub) => {
          function wrappedUnsub() {
            emit = error = complete = fp.noop;
            unsub();
          }
          pending = pending.then(
            () => {
              error(err, wrappedUnsub);
            }
          );
        },

        () => {
          pending.then(complete);
        }
      );
    };
  };
}

function makeTransform(xf) {
  const arity = _s.parseParams(xf).length;
  const transformer = (...args) => {
    assert(
      args.length >= arity,
      'Insufficient arguments, expected at least ' + arity);
    if (args.length === arity) {
      return xf(...args);
    }
    return util.emitter(
      xf(...args.slice(0, -1))(util.makeSource(fp.last(args)))
    );
  };
  return transformer;
}

module.exports = fp.mapValues(makeTransform, {
  map,
  filter,
  take,
  latest,
  resolve,
  debounce,
  changes,
  tap,
  log,
  startWith,
  observe,
  reduce,
});
