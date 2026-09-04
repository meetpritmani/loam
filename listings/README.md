# /listings

Required by Shopify once a theme ships more than one preset (`config/
settings_data.json`'s `presets` object currently has two: `Loam`,
`Fernway Night`) — see
https://shopify.dev/docs/storefronts/themes/store/success/updates#adding-theme-presets.

Each subfolder here is named as a kebab-case slug of its preset
(`loam`, `fernway-night`) and can carry a `templates/` (and optionally
`sections/`) directory whose `.json` files *overwrite* the corresponding
root-level file, just for that preset's Theme Store listing/demo
rendering.

**Both folders are intentionally empty of template overrides.** `Loam`
and `Fernway Night` render from byte-identical template JSON — every
section in every template references the same `color_scheme` ids
(`scheme-paper`, `scheme-ink`, etc.), and the entire visual difference
between the two presets comes from `config/settings_data.json`'s own
per-preset `color_schemes` block redefining what those ids resolve to
(light hexes for Loam, dark hexes for Fernway Night) — a mechanism
that's already correctly built and entirely separate from this folder.
Shopify's own guidance is explicit: *"Include preset-unique .json files
in each preset listing folder; no need to duplicate identical files."*
Since nothing is template-unique to either preset, nothing belongs here
beyond the folders themselves (kept alive in git via `.gitkeep`, since
git doesn't track empty directories).

If a future section or template setting is ever added that genuinely
needs to differ by preset (not just by color), that override goes in
`listings/<preset>/templates/<template>.json` — copy the root file,
change only what needs to change for that preset, and drop the
`.gitkeep` once a real file exists.
