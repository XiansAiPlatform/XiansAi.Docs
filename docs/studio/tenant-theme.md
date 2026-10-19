# Tenant Theme

Each tenant has its own visual theme — color scheme, logo, and favicon shown in the Studio chrome and (optionally) in the chat widget your participants see. Changing it requires the **Tenant Admin** role (or System Admin).

## Where

`Tenant Admin → Branding`

## What you can change

| Setting | Notes |
| --- | --- |
| **Color theme** | Choose from the curated palette: **Lingon** (warm coral), **Fjord** (deep navy), **Skog** (forest green), **Zenith** (classic red), or **Gaia** (ocean teal). |
| **Logo** | Upload an image file (PNG or SVG, up to ~700 KB) or supply an external image URL. Displayed in the Studio header and on login screens. |
| **Favicon** | Upload an image file (square PNG, SVG, or ICO, at least 32×32 px, up to 256 KB) or supply an external image URL. Shown in the browser tab and bookmarks. |

## Which icon the browser tab shows

The browser tab uses the first of these that is set:

1. The tenant's **favicon**
2. The tenant's **logo**
3. The default Agent Studio icon

The logo and favicon are separate settings. Setting a favicon does not change the logo shown in the Studio header, and removing one does not remove the other.

## Scope and rollout

- Theme changes apply to **the entire tenant** — every user and every embedded chat widget.
- Changes take effect immediately — no rebuild or restart required.
- A new favicon shows straight away for the admin who saved it. Other users' browsers may keep showing the old icon for up to an hour.

!!! tip "Resetting the theme"
    Use the **Reset to default** action to clear any custom theme and revert to the platform default.
