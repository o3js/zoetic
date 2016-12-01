const fp = require('lodash/fp');
const Promise = require('bluebird');

function map(fn) {
  return (source) => (emit, error, complete) => {
    return source(
      // wasteful array boxing, but the idea is to use the lodash
      // implementation
      (item, unsub) => { emit(fn(item), unsub); },
      error,
      complete);
  };
}

function take(count) {
  return (source) => {
    let remaining = count;
    return (emit, error, complete) => {
      if (remaining === 0) {
        complete();
        // never subscribed
        return fp.noop;
      }
      return source(
        (val, unsub) => {
          remaining--;
          emit(val, unsub);
          if (!remaining) {
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
    const buffered = [];
    return (emit, error, complete) => {
      return source(
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

function changes() {
  return (source) => {
    const last = [];
    return (emit, error, complete) => {
      return source(
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

function debounce(ms) {
  return (source) => {
    let myTimeout;
    let flushed;
    let completed;
    return (next, error, complete) => {
      return source(
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
    return source(
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
    let pending = Promise.resolve();
    return (emit, error, complete) => {
      const unsubscribe = source(

        (val, unsub) => {
          const wrappedUnsub = () => {
            emit = error = complete = fp.noop;
            unsub();
          };
          pending = pending.then(
            () => {
              return Promise.resolve(val)
                .then((item) => emit(item, wrappedUnsub),
                      (err) => error(err, wrappedUnsub));
            }
          );
        },

        (err, unsub) => {
          const wrappedUnsub = () => {
            emit = error = complete = fp.noop;
            unsub();
          };
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
      return () => {
        emit = error = complete = fp.noop;
        unsubscribe();
      };
    };
  };
}


module.exports = {
  map,
  take,
  latest,
  resolve,
  debounce,
  changes,
  tap,
  log,
};
