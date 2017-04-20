import { DocumentClient } from 'documentdb';
import { LoggerInstance } from 'winston';

/** DocumentDbLogger configuration  */
export interface DocumentDbTransportConfig {
  /** DocumentDb database name (created if it does not exist) */
  databaseName: string;

  /** DocumentDb collection name (created if it does not exist) */
  collectionName: string;

  /** Max simultaneous writes to DocumentDb (default: 1) */
  concurrency?: number;

  /** Replace any Buffer object in event meta object with a hash of the buffer (default: true) */
  attachMedia?: boolean;

  /** Collection throughput for created collections (default: 10000) */
  collectionThroughput?: number;

  /** Default time-to-live for created collections */
  defaultTtl?: number;

  /** Partition key to use, if the collection is partitioned */
  partitionKey?: string;
}

export interface DocumentDbTransportOptions extends DocumentDbTransportConfig {
  /** Configured DocumentDb client */
  client: DocumentClient;
}

export interface Media {
  id: string,
  data: Buffer,
}

interface LogEvent {
  doc: LogDocument;
  callback(err: Error, success: boolean): void;
}

interface LogDocument {
  level: string;
  message: string;
  meta?: any;
  time: Date;
}

/**
 * DocumentDb Logger for winston
 */
export class DocumentDbTransport extends NodeJS.EventEmitter, LoggerInstance {
  /** Create new DocumentDbLogger */
  constructor(options: DocumentDbTransportOptions);

  private _options: DocumentDbTransportOptions;
  private _queue: Array<LogEvent>;
  private _pending: number;
  private _client: DocumentClient;
  private _collectionLink: string;

  log(level: string, message: string, meta: any, callback: (err: Error, success: boolean) => void): void
  on(event: string, callback: (event: any) => void);
}

export function registerTransport();
