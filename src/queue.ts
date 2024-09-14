export type QueueJob = () => unknown | Promise<unknown>;

export type QueueErrorHandler = (error: Error) => void;

export class Queue {
  private counter: number = 0;
  private pending: QueueJob[] = [];
  private resolve?: () => void;
  private onErrorHandle?: QueueErrorHandler;

  /**
   *
   * A simple job queue with concurrency
   *
   * Note: exceptions are silenced by default. Queue does not stop fail on job exception.
   *
   */
  constructor(
    /** Maximum number of jobs to run simultaneously (default 10) */
    private readonly concurrency: number = 10,
  ) {
    if (typeof concurrency !== 'number') {
      throw new TypeError(`"concurrency" should be a number`);
    }
    if (concurrency < 1 || concurrency === Infinity || !concurrency) {
      throw new RangeError(`"concurrency" should be positive finite number`);
    }
  }

  /** Number of jobs that are waiting to be started */
  get pendingJobs() {
    return this.pending.length;
  }

  /** Number of jobs that has been started but not yet finished */
  get jobs() {
    return this.counter;
  }

  /** Add job to queue */
  public enqueue(job: QueueJob): void {
    this.pending.push(job);
  }

  /** Start queue execution */
  public start(): void {
    this.execute();
  }

  /** Wait for queue to be exhausted (starts if needed) */
  public wait(): Promise<void> {
    // Start work if it hasn't been done yet
    if (this.counter === 0) {
      this.start();
    }

    return new Promise(resolve => {
      // Exit immediately if work is done already
      if (this.counter === 0 && this.pendingJobs === 0) {
        return resolve();
      }

      this.resolve = resolve;
    });
  }

  /** Set an error handler function */
  public onError(fn: QueueErrorHandler) {
    this.onErrorHandle = fn;
  }

  private execute() {
    while (this.counter < this.concurrency) {
      const job = this.pending.shift();

      // Jobs exhausted
      if (!job) {
        return this.counter === 0 && this.finish();
      }

      this.counter++;
      const r = job();
      if (r instanceof Promise) {
        r.catch(e =>
          this.onErrorHandle ? this.onErrorHandle(e) : undefined,
        ).finally(() => {
          this.counter--;
          this.execute();
        });
      } else {
        this.counter--;
        this.execute();
      }
    }
  }

  private finish() {
    if (typeof this.resolve === 'function') {
      this.resolve();
    }
  }
}
