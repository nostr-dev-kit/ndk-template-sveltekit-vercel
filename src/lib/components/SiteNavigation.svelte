<script lang="ts">
  import { page } from '$app/state';

  const items = [
    { href: '/', label: 'Home' },
    { href: '/projects', label: 'Projects' }
  ];

  function isActive(href: string): boolean {
    const pathname = page.url.pathname;
    if (href === '/') return pathname === '/';
    if (href === '/projects') return pathname === '/projects' || pathname.startsWith('/p/');
    return false;
  }
</script>

<nav class="site-navigation">
  {#each items as item (item.href)}
    <a
      href={item.href}
      class="site-navigation-link"
      class:active={isActive(item.href)}
      aria-current={isActive(item.href) ? 'page' : undefined}
    >
      {item.label}
    </a>
  {/each}
</nav>
