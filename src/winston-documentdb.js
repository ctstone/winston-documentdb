const winston = require('winston');
const util = require('util');
const crypto = require('crypto');

exports.DocumentDbLogger = function(options) {
  winston.Transport.call(this, options);
  this._options = options || { };
  this._options.concurrency = this._options.concurrency || 1;
  this._options.hashBuffers = this._options.hashBuffers === false ? false : true;
  this._queue = [];
  this._pending = 0;
  this._client = this._options.client;
};

exports.DocumentDbLogger.prototype.log = function(level, message, meta, callback) {
  meta = prepareMeta(this, meta);
  const entry = { doc: { level, message, meta, time: new Date().getTime() }, callback };

  // write immediately
  if (this._pending < this._options.concurrency) {
    writeNext(this, entry);

  // append to queue
  } else {
    this._queue.push(entry);
  }
};

function writeNext(logger, entry) {
  const collectionLink = `dbs/${logger._options.databaseName}/colls/${logger._options.collectionName}`;
  logger._pending += 1;
  logger._client.createDocument(collectionLink, entry.doc, (err => {
    setImmediate(() => entry.callback(err, !!err));
    logger._pending -= 1;
    if (logger._queue.length) {
      const next = logger._queue.splice(-1, 1)[0];
      writeNext(logger, next, entry.callback);
    }
  }));
}

function prepareMeta(logger, obj) {
  if (obj instanceof Error) {
    return { name: obj.name, message: obj.message, stack: obj.stack };
  } else if (Buffer.isBuffer(obj)) {
    return logger._options.hashBuffers 
      ? { $buffer: hash(obj) }
      : obj;
  } else if (Array.isArray(obj)) {
    return obj.map(x => prepareMeta(logger, x));
  } else if (typeof obj == 'object') {
    const clone = {};
    Object.keys(obj).forEach((x) => clone[x] = prepareMeta(logger, obj[x]));
    return clone;
  } else {
    return obj;
  }
}

function hash(buf) { // TODO options for algo and encoding
  return crypto.createHash('md5').update(buf).digest('hex');
}

util.inherits(exports.DocumentDbLogger, winston.Transport);