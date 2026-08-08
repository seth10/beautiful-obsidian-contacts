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
beli: username
beliName: Display Name
discord: <username|1234567890123456789>
---

The rest of your note.
```

Except for the single-value `legalName` field, any value may also be a YAML list, e.g. `name: [First Last, "The Boss"]` (extra names show up under their primary name) or `phone: [5551234567, 5559876543]`. The card renders on any note that has at least one recognized field. On those notes the raw Properties panel is hidden by default so the contact card is the only top panel (toggle this in settings).

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
- `legalName` (single value; rendered below names)
- `birthday`
- `phone`
- `email`
- `insta`
- `beli`
- `beliName` (pairs by index with `beli`; rendered in parentheses after its Beli username)
- `discord`
- `address` (see [Addresses](#addresses))

## Formatting details
Fields and their values are separated by a colon. Any value may be a list, denoted by one or more commas. Brackets are optional. Extra commas or whitespace will be ignored. You can also provide additional phone numbers, emails, etc. on separate lines as long as each starts with the field name and a colon.

If you provide multiple names, any subsequent names after the first will be listed as nicknames.

Use `legalName` for one legal name. It is rendered below the display name and nicknames, before the other contact details, at reduced emphasis.

If you provide a [valid birthday](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date#date_string), it will be formatted and a calculated age will be displayed. If not, the provided birthday will be displayed as-is. You can set your preferences for how formatted dates are displayed in the "Beautiful Contact Cards" community plugin settings. Birthdays without a year are also supported.

Phone numbers may include a country code, but if it's excluded then +1 will be assumed. Formatting like +, (), and - may be included or excluded, but will be rendered in this standard format regardless. Each phone number will render two links: one to call, and one to message.

Emails won't be rendered if they don't appear to be a valid email address.

Instagram usernames may include or exclude the preceding @ sign.

Beli usernames and Beli names may both be lists. Each `beliName` is paired with the `beli` username at the same list index; Beli usernames without a matching name render without parentheses.

You may provide Discord username(s); or, if you would like a convenient link directly to your DM with that user (works on Desktop and Mobile), you can further provide that channel ID after a pipe symbol. Angle brackets surrounding this pair are optional. To obtain the channel ID, see https://wiki.discord.id/obtain-ids/desktop. In the "Beautiful Contact Cards" community plugin settings you can decide whether you want links to open in your native client or a browser.

## Addresses

Type an address the way you'd write it on an envelope — one line, with commas. No need to break it into separate street/city/state/zip fields.

```
---
name: First Last
address: 123 Main St, Apt 4, Seattle WA 98101
building: The Pinnacle
---
```

`building` is the building or apartment complex name. It's shown above the address and can be toggled off in settings.

If you want to save only the approximate location or a general area, use the `near` + `radius` keys, or `area`.

### Past addresses and approximate places

To record more than one place, such as an archive of previous addresses, use the `addresses` list. Each item is either a plain address string or an object:

```
---
name: First Last
addresses:
  - 123 Main St, Apt 4, Seattle WA 98101   # current (a bare string)
  - address: 789 Old Ave, Portland OR 97201
    until: 2023-08                            # archived — moved out
  - area: Greenlake, Seattle                  # a named area, not a precise spot
  - near: Greenlake Park                      # lives near a landmark...
    radius: 3 blocks                          # ...with this much uncertainty
---
```

- An entry is treated as **past/archived** if it has an `until` date or `archived: true`. By default the card shows only current addresses; toggle "Show only current addresses" in settings to show the full history.
- `area` records a neighborhood/region rather than a precise street address.
- `near` records a reference point the person lives near, and `radius` records how uncertain that is (free text like `3 blocks`, `0.5 mi`, `500m`).
- All this works in a `contact` code block too. You can repeat address fields in code blocks, or use a quoted bracket list (`address: ["123 Main St, Seattle", "456 South St, Portland"]`).
- Note: Obsidian's Properties panel might flag the `addresses` list with an orange `!` and offer to "Display as multitext". Don't accept, or it will flatten your addresses to "[object Object]" and you will lose data. Edit in source mode if you see this warning. If/when Obsidian adds a property type for a list of objects, this caveat will go away on its own.

## A note on updates
If you changed any plugin settings before upgrading to 2.0.0, the "Render from properties" option is disabled upon upgrade. This is to avoid a surprising behavior change, where your existing notes with name, email, etc. properties start displaying a contact card when you might not expect it. To opt in, go to Settings → Community plugins → Beautiful Contact Cards and enable "Render from properties".

Given this can only be detected for users who saved a setting at least once, this upgrade to 2.0.0+ might enable "Render from properties" by default as with fresh installs. If you have existing notes with a recognized property (such as `name`) and don't want to display contact cards, simply disable "Render from properties" in the plugin settings.

## Statement on AI
If you're staunchly against AI, remain at version 1.6.2. This version and all before were entirely hand-coded.
