import { Plugin } from 'obsidian'
import { DEFAULT_SETTINGS } from './types/plugin-settings.intf'
import type { PluginSettings } from './types/plugin-settings.intf'
import { MyPluginSettingTab } from './settings/settings-tab'
import { GraphView } from './views/graph-view'
import { GRAPH_VIEW_TYPE, getGraphViewOptions } from './views/graph-view-options'
import { log } from '../utils/log'
import { produce } from 'immer'
import type { Draft } from 'immer'

// TODO: Rename this class to match your plugin name (e.g., MyAwesomePlugin)
export class MyPlugin extends Plugin {
    /**
     * The plugin settings are immutable
     */
    settings: PluginSettings = produce(DEFAULT_SETTINGS, () => DEFAULT_SETTINGS)

    /**
     * Executed as soon as the plugin loads
     */
    override async onload() {
        log('Initializing', 'debug')
        await this.loadSettings()

        // Register the Graph view for Bases
        this.registerGraphView()

        // Add a settings screen for the plugin
        this.addSettingTab(new MyPluginSettingTab(this.app, this))
    }

    /**
     * Register the Graph view for the Bases feature
     */
    private registerGraphView(): void {
        const registered = this.registerBasesView?.(GRAPH_VIEW_TYPE, {
            name: 'Graph',
            icon: 'git-branch',
            factory: (controller: unknown, containerEl: HTMLElement) =>
                // @ts-expect-error - Type workaround for internal Obsidian API
                new GraphView(controller, containerEl, this),
            options: getGraphViewOptions
        })

        if (registered === false) {
            log('Bases feature is not enabled in this vault. Graph view not registered.', 'warn')
        } else {
            log('Graph view registered successfully', 'debug')
        }
    }

    override onunload() {}

    /**
     * Load the plugin settings
     */
    async loadSettings() {
        log('Loading settings', 'debug')
        let loadedSettings = (await this.loadData()) as PluginSettings

        if (!loadedSettings) {
            log('Using default settings', 'debug')
            loadedSettings = produce(DEFAULT_SETTINGS, () => DEFAULT_SETTINGS)
            return
        }

        let needToSaveSettings = false

        this.settings = produce(this.settings, (draft: Draft<PluginSettings>) => {
            if (loadedSettings.enabled) {
                draft.enabled = loadedSettings.enabled
            } else {
                log('The loaded settings miss the [enabled] property', 'debug')
                needToSaveSettings = true
            }
        })

        log(`Settings loaded`, 'debug', loadedSettings)

        if (needToSaveSettings) {
            this.saveSettings()
        }
    }

    /**
     * Save the plugin settings
     */
    async saveSettings() {
        log('Saving settings', 'debug', this.settings)
        await this.saveData(this.settings)
        log('Settings saved', 'debug', this.settings)
    }
}
