const valid_settings = [
    "scrollbox_height"
]

export var R20A_SettingsManager = class {
    scrollbox_height = 400;

    constructor() {}

    deserialize(json_string) {
        let success = true;
        if (json_string) {
            const json_obj = JSON.parse(json_string);
            for (const [key, value] of Object.entries(json_obj)) {
                if (!this.receiveValue(key, value))
                {
                    success = false;
                }
            }
        }
        return success
    }

    serialize() {
        let json_obj = {};
        for (const setting of valid_settings) {
            json_obj[setting] = this[setting];
        }
        return JSON.stringify(json_obj);
    }

    receiveValue(setting_key, setting_value) {
        if (!valid_settings.includes(setting_key)) {
            console.error("r20a: Invalid setting key " + setting_key);
            return false;
        }

        if (Number.isNaN(setting_value)) {
            console.error("r20a: NaN value for setting " + setting_key);
            return false;
        }

        const incoming_type = typeof (setting_value);
        const saved_type = typeof (this[setting_key]);

        if (incoming_type === 'undefined'
            || saved_type === 'undefined'
            || incoming_type !== saved_type) {
            console.error(`r20a: Invalid type ${incoming_type} for setting ${setting_key}`);
            return false;
        }

        this[setting_key] = setting_value;

        console.info(`received value ${setting_key}:${setting_value}`)

        return true;
    }

    saveToStorage() {
        if (typeof browser === "undefined") {
            var browser = chrome;
        }
        browser.storage.local.set({ settings: this.serialize() })
            .catch((err) => {
                console.error("r20a: Error setting storage");
                console.error(err);
            });
    }

    static loadFromStorage() {
        if (typeof browser === "undefined") {
            var browser = chrome;
        }
        browser.storage.local.get({ "settings": "" })
            .then(
                (results) => {
                    console.log("loadFromStorage success")
                    const settings = new R20A_SettingsManager();
                    settings.deserialize(results.settings)
                    settings.saveToStorage()
                    window.r20a_settings = settings;

                    window.r20a_settings.sendLoadedEvent();

                    return settings;
                },
                (err) => {
                    console.log("r20a: Error getting storage");
                    console.error(err);
                }
            );
    }

    static LoadedEventName = "r20asettingsloaded"

    sendLoadedEvent() {
        var evt = new CustomEvent("r20asettingsloaded", {
            detail: this.serialize()
        });

        window.dispatchEvent(evt);
    }
};
