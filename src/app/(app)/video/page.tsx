import { redirect } from 'next/navigation';

/**
 * /video — the Video Studio has no page of its own: every mode is an
 * independent route and an independent sidebar item.
 *
 * This redirect keeps the old entry point working and sends it to the
 * primary mode.
 */
export default function VideoPage(): never {
  return redirect('/video/generation');
}
