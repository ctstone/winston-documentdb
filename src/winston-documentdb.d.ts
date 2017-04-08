import { DocumentClient } from 'documentdb';

/** DocumentDbLogger configuration  */
export interface DocumentDbOptions {

  /** DocumentDb client */
  client: DocumentClient;

  /** DocumentDb database name (created if it does not exist) */
  databaseName: string;

  /** DocumentDb collection name (created if it does not exist) */
  collectionName: string;

  /** Max simultaneous writes to DocumentDb */
  concurrency?: number;

  /** Replace any Buffer object in event meta object with a hash of the buffer */
  attachMedia?: boolean;

  /** Collection throughput for created collections */
  collectionThroughput?: number;

  /** Default time-to-live for created collections (-1 to disable) */
  defaultTtl?: number;

  /** Partition key to use, if the collection is partitioned */
  partitionKey?: string;
}

export interface Media {
  id: string,
  media: Buffer,
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
export class DocumentDbLogger extends NodeJS.EventEmitter {
  /** Create new DocumentDbLogger */
  constructor(options?: DocumentDbOptions);

  private _options: DocumentDbOptions;
  private _queue: Array<LogEvent>;
  private _pending: number;
  private _client: DocumentClient;
  private _collectionLink: string;

  log(level: string, message: string, meta: any, callback: (err: Error, success: boolean) => void): void
  on(event: string, callback: (event: any) => void);
}
