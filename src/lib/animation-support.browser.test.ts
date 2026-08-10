import { describe, expect, it } from 'vitest';

describe('browser project', () => {
  it('has the Web Animations API that jsdom lacks', async () => {
    const el = document.createElement('div');
    document.body.append(el);
    el.animate([{ transform: 'translateX(0px)' }, { transform: 'translateX(400px)' }], {
      duration: 1000,
      easing: 'linear',
    });

    const animations = el.getAnimations();
    expect(animations).toHaveLength(1);

    const animation = animations[0];
    if (!animation) throw new Error('expected an animation');
    animation.pause();
    animation.currentTime = 250;
    await animation.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });

    expect(new DOMMatrix(getComputedStyle(el).transform).m41).toBeCloseTo(100, 1);
    el.remove();
  });
});
