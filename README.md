# Beautiful Obsidian Contacts

This is a plugin for Obsidian (https://obsidian.md). It will render a contact card given the data present in a `contact` code block.

## Example
````
Some other text in your note.

```contact
name: First Last
phone: 5551234567
email: user@example.com
insta: username
```

Some further text in your note.
````

### Output
![An Obsidian window showing a note in editing mode with a card rendered in the middle, containing a name and linked contact info](example-output.png)

## Formatting details
Keys and values are separated by a colon. Any value may may be a list, denoted by one or more commas. Brackets are optional. Empty list items will be ignored.

If a list of names is provided, only the first will be rendered.

Phone numbers may include a country code, but if it's excluded then +1 will be assumed. Formatting like +, (), and - may be included or excluded, but will be rendered in this standard format regardless. Each phone number will render two links: one to call, and one to message.

Emails won't be rendered if they don't appear to be a valid email address.

Instagram usernames may include or exclude the preceeding @ sign.
