require('chai').use(require('chai-as-promised'));
const mochaBrackets = require('mocha-brackets');

mochaBrackets.load({}, require('./test'));
