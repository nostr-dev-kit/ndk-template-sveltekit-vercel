<script lang="ts">
  import { page } from '$app/state';
  import * as NavigationMenu from '$lib/components/ui/navigation-menu';

  const items = [
    { href: '/', label: 'Read' },
    { href: '/about', label: 'About' }
  ];

  function isActive(href: string): boolean {
    const pathname = page.url.pathname;
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  }
</script>

<div class="site-navigation">
  <NavigationMenu.Root class="site-navigation-root">
    <NavigationMenu.List class="site-navigation-list">
      {#each items as item (item.href)}
        <NavigationMenu.Item>
          <NavigationMenu.Link
            href={item.href}
            active={isActive(item.href)}
            aria-current={isActive(item.href) ? 'page' : undefined}
            class="site-navigation-link"
          >
            {item.label}
          </NavigationMenu.Link>
        </NavigationMenu.Item>
      {/each}
    </NavigationMenu.List>
  </NavigationMenu.Root>
</div>
