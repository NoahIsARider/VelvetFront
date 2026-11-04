Velvet Front 0.9.2 is the first public build.

## Install

1. Download `Velvet-Front-0.9.2-win.zip` below.
2. Unzip it anywhere. Keep the whole folder together.
3. Run `Velvet Front.exe`.

No installer, no account, no network access. The first launch will show a SmartScreen warning because the binary is unsigned. Choose More info, then Run anyway.

## What is in this build

- Six chapters of top-down tactics on painted battlefields, from Sweetberry River to the Black Altar.
- A field decision before every deployment, mercy or zeal, recorded across the whole campaign.
- Permanent casualties. Dead rabbits are replaced by conscripts in later chapters.
- Three black contracts with their own rules and best scores.
- A quartermaster with three permanent upgrades.
- Keyboard, mouse and controller input, plus text scale, reduced motion and high contrast.

## Fixed in 0.9.2

- **The packaged window rendered with no art.** Every asset reference was root-absolute, so inside `app.asar` they resolved against the filesystem root. The build now emits relative asset paths and the app loads all art, panels, frames and audio from disk.
- Card headings no longer collide with the painted parchment border.
- The options input guide uses a sliced panel frame instead of a squashed one, so the text stays inside it.
- The battle HUD panels got enough height for their objective line.
- The window icon is a proper 128 px crop of the key art instead of a sprite atlas.

## Requirements

- Windows 10 or 11, x64.
- About 500 MB of disk space once unzipped.

## Content note

Fantasy violence, gore, body horror and a story about a holy war waged on civilians. Not for young players.
