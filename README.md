# Beautiful Contact Cards

This is a plugin for Obsidian (https://obsidian.md). It renders a contact card with tappable links from a note's properties, or from a `contact` code block.

## Properties

Add contact fields to a note's properties/frontmatter and a card is rendered at the top of the note, before all other content, in both Reading view and Live Preview.

```
---
name: First Last, "The Big Cheese"
birthday: 2000-02-01
phone: 5551234567
email: user@example.com
insta: username
discord: <username|1234567890123456789>
---

The rest of your note.
```

Any value may also be a YAML list, e.g. `name: [First Last, "The Boss"]` (extra names become nicknames) or `phone: [5551234567, 5559876543]`. The card renders on any note that has at least one recognized field. On those notes the raw Properties panel is hidden by default so the contact card is the only top panel (toggle this in settings).

![An Obsidian window showing a contact card with linked contact info below the note's title. An adjoining screenshot shows the note's frontmatter in source mode.](Screenshots/Contact%20card%20from%20properties,%20source%20mode.png)

## Code block

The original `contact` code block implementation is still supported and can be used anywhere in a note. These also support repeated fields, unlike properties where you must use lists.

````
Some other text in your note.

```contact
name: First Last
phone: 5551234567
phone: 5559876543
```

Some further text in your note.
````

![An Obsidian window showing a note in editing mode with a card rendered in the middle, containing a name and linked contact info. An adjoining screenshot shows the source of the code block that renders as a contact card.](Screenshots/Contact%20card%20from%20code%20block,%20editing.png)

## Supported fields
- `name`
- `birthday`
- `phone`
- `email`
- `insta`
- `discord`

## Formatting details
Fields and their values are separated by a colon. Any value may be a list, denoted by one or more commas. Brackets are optional. Extra commas or whitespace will be ignored. You can also provide additional phone numbers, emails, etc. on separate lines as long as each starts with the field name and a colon.

If you provide multiple names, any subsequent names after the first will be listed as nicknames.

If you provide a [valid birthday](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date#date_string), it will be formatted and a calculated age will be displayed. If not, the provided birthday will be displayed as-is. You can set your preferences for how formatted dates are displayed in the "Beautiful Contact Cards" community plugin settings. Birthdays without a year are also supported.

Phone numbers may include a country code, but if it's excluded then +1 will be assumed. Formatting like +, (), and - may be included or excluded, but will be rendered in this standard format regardless. Each phone number will render two links: one to call, and one to message.

Emails won't be rendered if they don't appear to be a valid email address.

Instagram usernames may include or exclude the preceding @ sign.

You may provide Discord username(s); or, if you would like a convenient link directly to your DM with that user (works on Desktop and Mobile), you can further provide that channel ID after a pipe symbol. Angle brackets surrounding this pair are optional. To obtain the channel ID, see https://wiki.discord.id/obtain-ids/desktop. In the "Beautiful Contact Cards" community plugin settings you can decide whether you want links to open in your native client or a browser.

## A note on updates
If you installed this plugin prior to 2.0.0, the "Render from properties" option will be disabled by default. This is to avoid a surprising behavior change, where your existing notes with a "name" property start displaying a contact card when you might not expect it. To opt-in, just go to Settings, Community plugins, Beautiful Contact Cards, and enable "Render from properties".

When installing this plugin for the first time at version 2.0.0 or beyond, "Render from properties" will be enabled by default.

## Statement on AI
If you're staunchly against AI, remain at version 1.6.2. This version and all before were entirely hand-coded.
