import { describe, expect, it } from 'vitest';
import { photosById, pickSource, videosById } from './people';

describe('AI people media', () => {
  it('names files after the exercise they show', () => {
    expect(photosById({ '../assets/people/squat.jpg': '/a/squat-1.jpg', '../assets/people/jumping_jack.webp': '/a/jj.webp' })).toEqual({
      squat: '/a/squat-1.jpg',
      jumping_jack: '/a/jj.webp',
    });
  });

  it('groups both video formats of one exercise', () => {
    expect(
      videosById({ '../assets/demo/squat.mp4': '/a/s.mp4', '../assets/demo/squat.webm': '/a/s.webm', '../assets/demo/plank.webm': '/a/p.webm' }),
    ).toEqual({ squat: { mp4: '/a/s.mp4', webm: '/a/s.webm' }, plank: { webm: '/a/p.webm' } });
  });

  it('plays MP4 where it can and falls back to WebM', () => {
    const both = { mp4: 'a.mp4', webm: 'a.webm' };
    expect(pickSource(both, () => true)).toBe('a.mp4');
    expect(pickSource(both, (type) => type.startsWith('video/webm'))).toBe('a.webm');
    expect(pickSource({ mp4: 'a.mp4' }, (type) => type.startsWith('video/webm'))).toBeUndefined();
  });
});
