export type FacingMode = 'user' | 'environment';

export class CameraError extends Error {
  constructor(
    message: string,
    readonly kind: 'insecure' | 'unsupported' | 'denied' | 'notfound' | 'busy' | 'unknown',
  ) {
    super(message);
  }
}

/** Opens the camera and attaches it to `video`. Resolves once frames are flowing. */
export async function startCamera(video: HTMLVideoElement, facingMode: FacingMode): Promise<MediaStream> {
  if (!window.isSecureContext) {
    throw new CameraError(
      'The camera only works over a secure connection. Open this app via https:// (or on localhost).',
      'insecure',
    );
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError("This browser can't access the camera. Try Chrome or Safari.", 'unsupported');
  }
  let stream: MediaStream;
  try {
    stream = await getStream(facingMode);
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new CameraError('Camera access was blocked. Allow the camera for this site in your browser settings, then try again.', 'denied');
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      throw new CameraError("I couldn't find a camera on this device.", 'notfound');
    }
    if (name === 'NotReadableError' || name === 'AbortError') {
      throw new CameraError('The camera is busy — close other apps that use it and try again.', 'busy');
    }
    throw new CameraError(`Couldn't start the camera: ${(err as Error)?.message ?? err}`, 'unknown');
  }
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  if (video.readyState < 2 || !video.videoWidth) {
    await new Promise<void>((resolve) => video.addEventListener('loadeddata', () => resolve(), { once: true }));
  }
  return stream;
}

/**
 * Asks for a 720p stream at ~30 fps, falling back to any camera when a device can't satisfy
 * the preferred settings (some phones and virtual cameras reject them outright).
 */
async function getStream(facingMode: FacingMode): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    { audio: false, video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } },
    { audio: false, video: { facingMode: { ideal: facingMode } } },
    { audio: false, video: true },
  ];
  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastError = err;
      const name = (err as DOMException)?.name;
      // Permission problems won't be fixed by relaxing constraints.
      if (name === 'NotAllowedError' || name === 'SecurityError') break;
    }
  }
  throw lastError;
}

export function stopCamera(stream: MediaStream | null, video?: HTMLVideoElement | null): void {
  stream?.getTracks().forEach((t) => t.stop());
  if (video) video.srcObject = null;
}
