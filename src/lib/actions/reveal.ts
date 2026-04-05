import { browser } from '$app/environment';

export function reveal(node: HTMLElement) {
  if (!browser || typeof IntersectionObserver === 'undefined') {
    node.classList.add('is-visible');
    return {
      destroy() {}
    };
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        node.classList.add('is-visible');
        observer.unobserve(node);
      }
    },
    {
      threshold: 0.12,
      rootMargin: '0px 0px -48px 0px'
    }
  );

  observer.observe(node);

  return {
    destroy() {
      observer.disconnect();
    }
  };
}
