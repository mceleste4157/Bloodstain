/**
 * Single source of truth for the in-app version label.
 *
 * Shown in a small badge on every screen so a deploy is visually confirmable.
 * Convention: bump by 0.01 on every publish (v0.11 → v0.12 → …). If the number
 * on the live site matches the one you expect, the new build went out.
 */
export const APP_VERSION = '0.16';
