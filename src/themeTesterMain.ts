
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { fetchPackageJSON, getLatestVersion } from './marketplace';
import { registerPlayground, openEditors } from './playground';

export function activate(context: vscode.ExtensionContext) {
	const playgroundData = vscode.Uri.joinPath(context.extensionUri, 'testData');
	const playground = registerPlayground(playgroundData);
	context.subscriptions.push(playground);

	const uriHandler = vscode.window.registerUriHandler({
		handleUri: uri => {
			if (uri.path === '/open' && uri.query) {
				const inputURI = vscode.Uri.parse(uri.query);
				handleUriLocation(inputURI.path);
			}
		}
	});
	context.subscriptions.push(uriHandler);

	vscode.commands.registerCommand('vscode-theme-tester.open', async () => {
		const location = await vscode.window.showInputBox({ value: 'azemoh.one-monokai' });
		if (!location) {
			return;
		}

		handleUriLocation('/editor/theme/' + location);
	});
}

type ThemeContribution = { id?: string; label: string };

type InstallResult = { settingsId: string; keep: () => Promise<void>; undo: () => Promise<void> };

async function handleUriLocation(location: string) {
	try {
		const match = /\/(?:theme)\/(?<publisher>[^.]+)\.(?<extensionName>[^/]+)(\/(?<themeName>.*))?$/i.exec(location);
		const groups = match?.groups;
		if (!groups) {
			vscode.window.showErrorMessage('Invalid URL. Must be in the form \'/theme/publisher.name(/themeName)?\'');
			return;
		}

		const { publisher, extensionName, themeName } = groups;

		const res = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: `Previewing theme extension ${publisher}.${extensionName}...`
		}, async (progress: vscode.Progress<{ message?: string; increment?: number }>) => {
			return await previewTheme(publisher, extensionName, themeName);
		});
		if (res) {
			const buttons = ['Install', 'Browse More...', 'Cancel'];
			const action = await vscode.window.showInformationMessage(`Welcome! Here's a preview of the ${res.settingsId} theme in ${getProductName()}.`, ...buttons);
			if (action === buttons[2]) {
				await res.undo();
			} else if (action === buttons[1]) {
				vscode.commands.executeCommand('workbench.action.browseColorThemesInMarketplace');		
			} else if (action === buttons[0]) {
				await res.keep();
				await vscode.window.showInformationMessage(`The theme is now installed and configured in the user settings.`);
			}
		}

	} catch (e) {
		console.log(e);
	}
}

function findBuiltInExtension(publisher: string, name: string): any | undefined {
	const extension = vscode.extensions.getExtension(`${publisher}.${name}`);
	if (extension) {
		return extension.packageJSON;
	}
	return undefined;
}

async function previewTheme(publisher: string, name: string, themeName: string): Promise<InstallResult | undefined> {

	const builtInManifest = findBuiltInExtension(publisher, name);

	const manifest = builtInManifest ?? await findMarketPlaceExtension(publisher, name);
	if (!manifest) {
		vscode.window.showErrorMessage(`Unable to find extension ${manifest.name} (${publisher}.${name}).`);
		return undefined;
	}

	const themes: ThemeContribution[] = manifest.contributes?.themes;
	if (!Array.isArray(themes) || themes.length === 0) {
		vscode.window.showErrorMessage(`Extension ${manifest.name} (${publisher}.${name}) does not contain any color themes.`);
		return undefined;
	}
	if (vscode.env.appHost === 'web' && !vscode.env.remoteName) {
		if (manifest.main && !manifest.browser) {
			vscode.window.showErrorMessage(`The extension ${manifest.name} (${publisher}.${name}) is not a web extension and can not be installed in ${getProductName()}. [Learn Why](https://aka.ms/vscode-web-extensions-guide).`);
			return undefined;
		}
	} else {
		if (manifest.main && !manifest.browser) {
			vscode.window.showErrorMessage(`The extension ${manifest.name} (${publisher}.${name}) is a web extension and can not be installed in ${getProductName()}.`);
			return undefined;
		}
	}
	const getSettingsId = (theme: ThemeContribution) => theme.id || theme.label;

	let settingsId: string | undefined = undefined;
	if (themeName) {
		themeName = themeName.toLowerCase();
		for (const theme of themes) {
			const currSettingsId = getSettingsId(theme);
			if (currSettingsId.toLowerCase() === themeName) {
				settingsId = currSettingsId;
				break;
			}
		}
		if (!settingsId) {
			vscode.window.showErrorMessage(`Extension ${manifest.name} (${publisher}.${name}) does not contain a color theme ${themeName}.\nTry one of ${themes.map(getSettingsId).join(', ')} instead.`);
			return undefined;
		}
	} else {
		settingsId = getSettingsId(themes[0]);
	}
	if (!settingsId) {
		return undefined;
	}

	openEditors(settingsId);

	const oldTheme = vscode.workspace.getConfiguration().inspect<string | undefined>('workbench.colorTheme')?.globalValue;
	const version = manifest.version;

	await vscode.commands.executeCommand('workbench.action.previewColorTheme', { publisher, name, version }, settingsId);

	const undo = async () => {
		await vscode.workspace.getConfiguration().update('workbench.colorTheme', settingsId, vscode.ConfigurationTarget.Global);
		await vscode.workspace.getConfiguration().update('workbench.colorTheme', oldTheme, vscode.ConfigurationTarget.Global);
	};

	const keep = async () => {
		if (builtInManifest === undefined) {
			await vscode.commands.executeCommand('workbench.extensions.installExtension', `${publisher}.${name}`);
		}

		await vscode.workspace.getConfiguration().update('workbench.colorTheme', settingsId, vscode.ConfigurationTarget.Global);
	};

	return { settingsId, keep, undo };
}

async function findMarketPlaceExtension(publisher: string, name: string): Promise<any | undefined> {
	const version = await getLatestVersion(publisher, name);
	if (version === undefined) {
		vscode.window.showErrorMessage(`Unable to find extension ${publisher}.${name} on the marketplace.`);
		return undefined;
	}

	return await fetchPackageJSON(publisher, name, version);
}


export function getProductName() {
	if (vscode.env.uiKind === vscode.UIKind.Web && !vscode.env.remoteName) {
		return 'Visual Studio Code for the Web';
	} else {
		return 'Visual Studio Code';
	}
}

// this method is called when your extension is deactivated
export function deactivate() { }


