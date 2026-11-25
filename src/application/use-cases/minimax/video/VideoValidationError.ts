/**
 * Raised when an inbound video request does not satisfy the documented
 * MiniMax H3 constraints. Route handlers translate it into a 400 response.
 */
export class VideoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VideoValidationError';
  }
}
