<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  interface Props extends ComponentProps<typeof DropdownMenuPrimitive.Item> {
    inset?: boolean;
  }

  let { class: className = '', children, inset = false, ...restProps }: Props = $props();
</script>

<DropdownMenuPrimitive.Item
  {...restProps}
  class={cn('dropdown-menu-item', inset && 'dropdown-menu-item-inset', className)}
>
  {@render children?.()}
</DropdownMenuPrimitive.Item>

<style>
  :global(.dropdown-menu-item) {
    display: flex;
    width: calc(100% - 0.75rem);
    margin: 0.2rem 0.375rem;
    align-items: center;
    gap: 0.75rem;
    border-radius: 0.85rem;
    padding: 0.75rem 0.85rem;
    color: var(--text-strong);
    cursor: pointer;
    user-select: none;
    transition:
      background-color 160ms ease,
      color 160ms ease,
      transform 160ms ease;
  }

  :global(.dropdown-menu-item-inset) {
    padding-left: 2.5rem;
  }

  :global(.dropdown-menu-item[data-highlighted]) {
    background: rgba(251, 243, 219, 0.9);
    color: var(--text-strong);
    transform: translateX(2px);
    outline: none;
  }

  :global(.dropdown-menu-item[data-disabled]) {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none;
  }
</style>
