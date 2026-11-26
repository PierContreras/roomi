import { afterNextRender, DestroyRef, Directive, ElementRef, inject } from '@angular/core';

@Directive({ selector: '[appRevealOnScroll]' })
export class RevealOnScroll {
  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const view = element.ownerDocument.defaultView;
      const motion = view?.matchMedia?.('(prefers-reduced-motion: no-preference)');
      if (!view?.IntersectionObserver || !motion?.matches || !element.animate) return;

      const observer = new view.IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        if (!motion.matches || element.matches(':focus-within')) return;

        element.animate(
          [{ opacity: 0.55, translate: '0 16px' }, { opacity: 1, translate: '0 0' }],
          { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        );
      }, { rootMargin: '0px 0px -72px 0px' });

      observer.observe(element);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
