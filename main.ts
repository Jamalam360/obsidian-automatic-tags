import { App, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";
import { default as matter, stringify as matterStringify } from "gray-matter";

interface AutomaticTagsSettings {
	tags: Record<string, string[]>;
}

const DEFAULT_SETTINGS: AutomaticTagsSettings = {
	tags: {},
};

export default class AutomaticTagsPlugin extends Plugin {
	settings: AutomaticTagsSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new AutomaticTagsSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			this.registerEvent(this.app.vault.on("create", async (file) => {
				if (Object.entries(this.settings.tags).length === 0) return;

				if (file instanceof TFile) {
					const tags: string[] = [];
					
					Object.entries(this.settings.tags).forEach(([k, v]) => {
						if (this.matchesGlob(file.path, k)) {
							tags.push(...v);
						}
					});

					if (tags.length === 0) return;

					await this.app.fileManager.processFrontMatter(file, (fm) => {
						fm.tags = [...new Set([...fm.tags, ...tags])];
					});
				}
			}));
		});
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	matchesGlob(path: string, glob: string): boolean {
		const regex = glob
			.replace(/\./g, "\\.")
			.replace(/\*/g, ".*")
			.replace(/\//g, "\\/");
		return new RegExp(regex).test(path);
	}
}

class AutomaticTagsSettingTab extends PluginSettingTab {
	plugin: AutomaticTagsPlugin;

	constructor(app: App, plugin: AutomaticTagsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Tags")
			.setDesc("Tags to be automatically added to notes, in a simplified glob format")
			.addTextArea((area) =>
				area
					.setValue(this.getTagsString())
					.setPlaceholder(
						"*: all\nfolder/subfolder: tag1, tag2\nother/folder: tag3"
					)
					.onChange(async (newValue) => {
						this.setTagsString(newValue);
						await this.plugin.saveSettings();
					})
			);
	}

	getTagsString(): string {
		let result = "";
		Object.entries(this.plugin.settings.tags).forEach(([k, v]) => {
			result += `${k}: ${v.join(", ")}\n`;
		});
		return result;
	}

	setTagsString(value: string): void {
		const result: Record<string, string[]> = {};

		for (const line of value.split("\n")) {
			if (line.trim().length === 0) continue;
			const key = line.split(":")[0];
			result[key.trim()] = line
			.substring(key.length + 1)
			.split(",")
				.map((v) => v.trim());		
		}

		this.plugin.settings.tags = result;
	}
}
