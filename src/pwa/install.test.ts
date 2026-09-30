import { describe, expect, it } from 'vitest';
import { detectPlatform, isInAppBrowser } from './install';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const INSTAGRAM = `${IPHONE} Instagram 350.0.0.0.0 (iPhone16,2; iOS 18_5; en_US)`;

describe('install: which phone are we on', () => {
  it('tells iPhone, iPad, Android and computers apart', () => {
    expect(detectPlatform(IPHONE, 5)).toBe('ios');
    // iPadOS pretends to be a Mac; only the touch screen gives it away.
    expect(detectPlatform(IPAD, 5)).toBe('ios');
    expect(detectPlatform(MAC, 0)).toBe('desktop');
    expect(detectPlatform(ANDROID, 5)).toBe('android');
  });

  it('spots in-app browsers that cannot install apps', () => {
    expect(isInAppBrowser(INSTAGRAM)).toBe(true);
    expect(isInAppBrowser(`${ANDROID} [FB_IAB/FB4A;FBAV/480.0.0.0;]`)).toBe(true);
    expect(isInAppBrowser(IPHONE)).toBe(false);
    expect(isInAppBrowser(ANDROID)).toBe(false);
  });
});
