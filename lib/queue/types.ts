export interface BatchQueueOptions {
  concurrency: number;
  /** Called after each item settles (success or failure). */
  onItemSettled?: (completed: number, total: number) => void;
  /** If true, stops scheduling new work once called (in-flight items still finish). */
  isCancelled?: () => boolean;
}
