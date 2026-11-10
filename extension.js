const vscode = require('vscode');

// Dark tones carry white/grey text, light tones carry dark text.
const TONES = {
    dark: {
        heading: 'Dark - white text',
        saturation: 0.6,
        lightness: 0.28,
        presets: [
            ['Red', '#8c1d18'],
            ['Orange', '#94440a'],
            ['Amber', '#755800'],
            ['Green', '#1e5e24'],
            ['Teal', '#00594f'],
            ['Blue', '#0f4c96'],
            ['Indigo', '#2c3a8c'],
            ['Purple', '#5e1a80'],
            ['Pink', '#8f1245'],
            ['Slate', '#37474f'],
        ],
    },
    light: {
        heading: 'Light - dark text',
        saturation: 0.7,
        lightness: 0.82,
        presets: [
            ['Red', '#f4b4ae'],
            ['Orange', '#f8c99b'],
            ['Amber', '#f3dc8a'],
            ['Green', '#b5dfb8'],
            ['Teal', '#a6dcd4'],
            ['Blue', '#a9cdf5'],
            ['Indigo', '#c0c6f0'],
            ['Purple', '#dcb8ec'],
            ['Pink', '#f5b5cf'],
            ['Slate', '#cfd8dc'],
        ],
    },
};

const KEYS = [
    'titleBar.activeBackground',
    'titleBar.activeForeground',
    'titleBar.inactiveBackground',
    'titleBar.inactiveForeground',
];

// ---- colour helpers ----

function normaliseHex(input) {
    const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(input).trim());
    if (!match) return undefined;
    let hex = match[1].toLowerCase();
    if (hex.length === 3) hex = hex.replace(/./g, c => c + c);
    return '#' + hex;
}

function toRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
}

function toHex(rgb) {
    return '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function mix(a, b, t) {
    const ra = toRgb(a), rb = toRgb(b);
    return toHex(ra.map((v, i) => v + (rb[i] - v) * t));
}

function luminance(hex) {
    const [r, g, b] = toRgb(hex).map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hslToHex(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = n => {
        const k = (n + h / 30) % 12;
        return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
    };
    return toHex([f(0), f(8), f(4)]);
}

function randomColour(tone) {
    const { saturation, lightness } = TONES[tone];
    return hslToHex(Math.floor(Math.random() * 360), saturation, lightness);
}

// Same project name always gives the same hue.
function autoColour(tone) {
    const { saturation, lightness } = TONES[tone];
    const name = vscode.workspace.name || '';
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return hslToHex(hash % 360, saturation, lightness);
}

function titleBarColours(hex) {
    const light = luminance(hex) > 0.3;
    const foreground = light ? '#15202b' : '#ffffff';
    return {
        'titleBar.activeBackground': hex,
        'titleBar.activeForeground': foreground,
        'titleBar.inactiveBackground': mix(hex, light ? '#d4d4d4' : '#3c3c3c', 0.4),
        'titleBar.inactiveForeground': foreground + 'aa',
    };
}

// ---- workspace settings ----

function workspaceCustomizations() {
    const inspected = vscode.workspace.getConfiguration('workbench').inspect('colorCustomizations');
    return (inspected && inspected.workspaceValue) || {};
}

function currentColour() {
    const value = workspaceCustomizations()['titleBar.activeBackground'];
    return value ? normaliseHex(value) : undefined;
}

async function apply(hex) {
    const customizations = { ...workspaceCustomizations() };
    for (const key of KEYS) delete customizations[key];
    if (hex) Object.assign(customizations, titleBarColours(hex));

    await vscode.workspace.getConfiguration('workbench').update(
        'colorCustomizations',
        Object.keys(customizations).length ? customizations : undefined,
        vscode.ConfigurationTarget.Workspace);
}

// Settings writes are serialised so rapid previews can't land out of order.
let queue = Promise.resolve();
function write(hex) {
    queue = queue.then(() => apply(hex)).catch(err => {
        vscode.window.showErrorMessage(`Title Tint: ${err.message || err}`);
    });
    return queue;
}

function hasWorkspace() {
    if (vscode.workspace.workspaceFile || (vscode.workspace.workspaceFolders || []).length) return true;
    vscode.window.showWarningMessage('Title Tint: open a folder or workspace first - the colour is saved per project.');
    return false;
}

function setColour(hex) {
    if (hasWorkspace()) write(hex);
}

async function customColour(initial) {
    if (!hasWorkspace()) return;
    const input = await vscode.window.showInputBox({
        title: 'Title bar colour',
        prompt: 'Hex colour, e.g. #1565c0',
        value: initial || currentColour() || '#',
        validateInput: value => normaliseHex(value) ? undefined : 'Enter a hex colour such as #1565c0 or #16c',
    });
    const hex = input && normaliseHex(input);
    if (hex) write(hex);
}

// ---- UI ----

function swatch(hex) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect x="1" y="1" width="14" height="14" rx="3" fill="${hex}"/></svg>`;
    return vscode.Uri.parse('data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'));
}

function pickColour() {
    if (!hasWorkspace()) return;

    const original = currentColour();
    let committed = original;   // what the window settles on when the picker closes
    let shown = original;       // what is currently written to settings
    let timer;

    const show = hex => {
        if (hex === shown) return;
        shown = hex;
        write(hex);
    };

    const tones = Object.entries(TONES);
    const items = [{ label: 'None', description: 'theme default', hex: undefined }];
    if (original && !tones.some(([, { presets }]) => presets.some(([, hex]) => hex === original))) {
        items.push({ label: 'Current', description: original, hex: original, iconPath: swatch(original) });
    }
    for (const [tone, { heading, presets }] of tones) {
        items.push({ label: heading, kind: vscode.QuickPickItemKind.Separator });
        for (const [label, hex] of presets) {
            items.push({ label, description: hex, hex, iconPath: swatch(hex) });
        }
        items.push(
            { label: '$(symbol-color) Auto', description: `${tone}, derived from the project name`, action: 'auto', tone },
            { label: '$(refresh) Random', description: `${tone}, press Enter again to re-roll`, action: 'random', tone });
    }
    items.push(
        { label: '', kind: vscode.QuickPickItemKind.Separator },
        { label: '$(edit) Custom hex…', action: 'custom' });

    const picker = vscode.window.createQuickPick();
    picker.title = `Title bar colour - ${vscode.workspace.name}`;
    picker.placeholder = 'Arrow keys preview, Enter keeps, Esc cancels';
    picker.matchOnDescription = true;
    picker.items = items;
    picker.activeItems = items.filter(item => !item.action && item.kind === undefined && item.hex === original).slice(-1);

    picker.onDidChangeActive(([item]) => {
        clearTimeout(timer);
        if (!item) return;
        const hex = item.action ? committed : item.hex;
        timer = setTimeout(() => show(hex), 100);
    });

    picker.onDidAccept(async () => {
        const item = picker.activeItems[0];
        if (!item) return;
        clearTimeout(timer);

        if (item.action === 'random') {
            committed = randomColour(item.tone);
            show(committed);
            return;
        }

        if (item.action === 'custom') {
            picker.hide();
            await customColour(committed);
            return;
        }

        committed = item.action === 'auto' ? autoColour(item.tone) : item.hex;
        picker.hide();
    });

    picker.onDidHide(() => {
        clearTimeout(timer);
        show(committed);
        picker.dispose();
    });

    picker.show();
}

function activate(context) {
    for (const [tone, { presets }] of Object.entries(TONES)) {
        for (const [label, hex] of presets) {
            context.subscriptions.push(
                vscode.commands.registerCommand(`titleTint.${tone}.${label.toLowerCase()}`, () => setColour(hex)));
        }
        context.subscriptions.push(
            vscode.commands.registerCommand(`titleTint.${tone}.auto`, () => setColour(autoColour(tone))),
            vscode.commands.registerCommand(`titleTint.${tone}.random`, () => setColour(randomColour(tone))));
    }

    // Extensions can't add a top-level menu bar entry, so this is the always-visible way in.
    const button = vscode.window.createStatusBarItem('titleTint.statusBar', vscode.StatusBarAlignment.Left, 10000);
    button.name = 'Title Tint';
    button.text = '$(paintcan) Title Tint';
    button.tooltip = 'Set the title bar colour for this project';
    button.command = 'titleTint.pick';
    button.show();

    context.subscriptions.push(
        button,
        vscode.commands.registerCommand('titleTint.custom', () => customColour()),
        vscode.commands.registerCommand('titleTint.pick', pickColour),
        vscode.commands.registerCommand('titleTint.clear', () => setColour(undefined)));
}

function deactivate() { }

module.exports = { activate, deactivate };
