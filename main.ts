import { Plugin, MarkdownPostProcessorContext, TFile } from 'obsidian';

export default class ContactCardPlugin extends Plugin {
	async onload() {
		// Register a markdown post processor to look for frontmatter in each note
		this.registerMarkdownPostProcessor((element: HTMLElement, context: MarkdownPostProcessorContext) => {			
			// Retrieve the TFile from the source path
			const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
			if (file instanceof TFile) {
				const fileCache = this.app.metadataCache.getFileCache(file);
				if (fileCache?.frontmatter) {
					const frontmatter = fileCache.frontmatter;
			
					// Extract fields for the contact card
					const name = frontmatter["name"] ?? "Unknown";
					const phone = frontmatter["phone"] ?? "No phone";
					const email = frontmatter["email"] ?? "No email";
					const insta = frontmatter["insta"] ?? "No Instagram";
			
					// Create a contact card div element
					const contactCard = element.createDiv({ cls: 'contact-card' });
					const nameDiv = contactCard.createDiv({ cls: 'contact-name', text: name})
					const phoneDiv = contactCard.createDiv({ cls: 'contact-field', text: `📞 ${phone}`})
					const emailDiv = contactCard.createDiv({ cls: 'contact-field', text: '📧 '})
					const emailLink = emailDiv.createEl('a', { href: 'mailto:${email}', text: email})
					const instaDiv = contactCard.createDiv({ cls: 'contact-field', text: '🔗 '})
					const instaLink = instaDiv.createEl('a', { href: 'https://www.instagram.com/${insta}/', text: '@'+insta})
				}
			}
		});
	}
}
