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
					const contactCard = document.createElement("div");
					contactCard.className = "contact-card";
					contactCard.innerHTML = `
					<div class="contact-name">${name}</div>
					<div class="contact-phone">📞 ${phone}</div>
					<div class="contact-email">📧 <a href="mailto:${email}">${email}</a></div>
					<div class="contact-website">🔗 <a href="https://www.instagram.com/${insta}/" target="_blank">@${insta}</a></div>
					`;
			
					// Append the contact card to the current element
					element.appendChild(contactCard);
				}
			}
		});
	}
}
