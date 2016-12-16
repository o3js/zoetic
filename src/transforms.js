const _s = require('o3-sugar');
const assert = require('o3-sugar').assert;
const util = require('./util');
const fp = require('lodash/fp');
const Promise = require('bluebird');

function map(mapper) {
  const fn = fp.isFunction(mapper) ? mapper : fp.get(mapper);
  return (source) => (emit, error, complete, opts) => {
    source(
      (item) => { emit(fn(item)); },
      error,
      complete,
      opts);
  };
}


function cat() {
  return (source) => (emit, error, complete, opts) => {
    let isParentComplete = false;
    let isActive = false;
    const children = [];

    function nextChild() {
      if (!children.length && isParentComplete) {
        complete();
        return;
      }
      if (children.length) {
        isActive = true;
        children.pop().subscribe(
          emit,
          error,
          () => { isActive = false; nextChild(); },
          opts);
      }
    }

    source(
      (item) => {
        children.push(item);
        if (!isActive) nextChild();
      },
      error,
      () => {
        isParentComplete = true;
        if (!children.length) complete();
      },
      opts);
  };
}

function mapcat(fn) {
  return fp.flow(map(fn), cat());
}

function filter(predicate) {
  return (source) => (emit, error, complete, opts) => {
    return source(
      (item) => {
        if (fp.filter(predicate, [item]).length > 0) emit(item);
      },
      error,
      complete,
      opts);
  };
}

function take(count) {
  return (source) => {
    return (emit, error, complete, opts) => {
      let remaining = count;
      if (remaining === 0) {
        complete();
      }

      const halter = util.halter(opts);

      source(
        (val) => {
          if (!remaining) return;
          remaining--;
          emit(val);
          if (remaining === 0 && !halter.isHalted()) {
            complete();
            halter.halt();
            return;
          }
        },
        error,
        complete,
        { onHalt: halter.onHalt });
    };
  };
}

function latest(count) {
  return (source) => {
    return (emit, error, complete, opts) => {
      const buffered = [];
      source(
        (item) => {
          buffered.push(item);
          if (buffered.length > count) buffered.shift();
          if (buffered.length === count) emit(fp.clone(buffered));
        },
        error,
        complete,
        opts);
    };
  };
}

function startWith(value) {
  return (source) => {
    return (emit, error, complete, opts) => {
      emit(value);
      source(emit, error, complete, opts);
    };
  };
}

function changes() {
  return (source) => {
    return (emit, error, complete, opts) => {
      const last = [];
      source(
        (item) => {
          if (last.length && fp.equals(last[0], item)) return;
          last[0] = item;
          emit(item);
        },
        error,
        complete,
        opts);
    };
  };
}

function observe(fn) {
  return (source) => {
    return (emit, error, complete, opts) => {
      fp.flowRight(
        changes(),
        startWith(fn()),
        map(fn)
      )(source)(emit, error, complete, opts);
    };
  };
}

function reduce(reducer, initial) {
  return (source) => {
    return (emit, error, complete, opts) => {
      let last = initial;
      emit(initial);

      let halted = false;
      opts.onHalt(() => {
        halted = true;
      });

      if (!halted) source(
        (item) => {
          last = reducer(fp.cloneDeep(last), item);
          emit(last);
        }, error, complete, opts);
    };
  };
}

function debounce(ms) {
  return (source) => {
    return (emit, error, complete, opts) => {
      let myTimeout;
      let flushed;
      let completed;

      let halted = false;
      opts.onHalt(() => {
        if (myTimeout) clearTimeout(myTimeout);
        halted = true;
      });

      source(
        (item) => {
          flushed = false;
          if (myTimeout) clearTimeout(myTimeout);
          myTimeout = setTimeout(() => {
            emit(item);
            flushed = true;
            if (completed && !halted) complete();
          }, ms);
        },
        error,
        () => {
          completed = true;
          if (flushed) complete();
        },
        opts);
    };
  };
}

function tap(fn) {
  return (source) => (emit, error, complete, opts) => {
    source(
      (item) => {
        fn(item); emit(item);
      },
      error, complete, opts);
  };
}

function log(label) {
  label = label || '';
  // eslint-disable-next-line no-console
  return tap((item) => { console.log(label, item); });
}

// Unsubscribe should halt emitting. this adds quite a bit of noise to the
// implementation -- perhaps there is a better way or it is not worth it.
function resolve() {
  return (source) => {
    return (emit, error, complete, opts) => {
      let pending = Promise.resolve();
      opts.onHalt(() => {
        emit = error = complete = fp.noop;
      });
      source(
        (val) => {
          pending = pending.then(
            () => {
              return Promise.resolve(val)
                .then((item) => emit(item),
                      (err) => error(err));
            }
          );
        },

        (err) => {
          pending = pending.then(() => { error(err); });
        },

        () => {
          pending.then(complete);
        },
        opts
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
  cat,
  mapcat,
});
