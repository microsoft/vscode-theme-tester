
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

		handleUriLocation('/theme/' + location);
	});
}

type InstallResult = { newThemSetting: string; keep: () => Promise<void>; undo: () => Promise<void> };

async function handleUriLocation(location: string) {
	try {
		const match = /^\/(?:theme)\/(?<publisher>[^.]+)\.(?<extensionName>[^/]+)(\/(?<themeName>.*))?$/i.exec(location);
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
			const buttons = ['Keep', 'Don\'t Keep'];
			const action = await vscode.window.showInformationMessage(`Welcome! Here's a preview of the ${res.newThemSetting} theme in ${getProductName()}.`, ...buttons);
			if (action === buttons[1]) {
				await res.undo();
			} else if (action === buttons[0]) {
				await res.keep();
				await vscode.commands.executeCommand('vscode.newWindow', { reuseWindow: true });
			}
		}

	} catch (e) {
		console.log(e);
	}
}

function findBuiltInExtension(publisher: string, name: string, themeName: string | undefined): any | undefined {
	const extension = vscode.extensions.getExtension(`${publisher}.${name}`);
	if (extension) {
		return extension.packageJSON;
	}
	return undefined;
}

async function previewTheme(publisher: string, name: string, themeName: string): Promise<InstallResult | undefined> {

	const manifest = findBuiltInExtension(publisher, name, themeName) || await findMarketPlaceExtension(publisher, name, themeName);
	if (!manifest) {
		vscode.window.showErrorMessage(`Unabel to find extension ${manifest.name} (${publisher}.${name}).`);
		return undefined;
	}

	const themes: { label: string }[] = manifest.contributes?.themes;
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
	let themeToOpen = themes[0].label;
	if (themeName) {
		themeName = themeName.toLowerCase();
		for (const theme of themes) {
			if (theme.label.toLowerCase() === themeName) {
				themeToOpen = theme.label;
				break;
			}
		}
	}
	if (!themeToOpen) {
		return undefined;
	}

	openEditors(themeToOpen);

	const oldTheme = vscode.workspace.getConfiguration().inspect<string | undefined>('workbench.colorTheme')?.globalValue;
	const version = manifest.version;

	await vscode.commands.executeCommand('workbench.action.previewColorTheme', { publisher, name, version }, themeToOpen);

	const undo = async () => {
		await vscode.workspace.getConfiguration().update('workbench.colorTheme', themeToOpen, vscode.ConfigurationTarget.Global);
		await vscode.workspace.getConfiguration().update('workbench.colorTheme', oldTheme, vscode.ConfigurationTarget.Global);
	};

	const keep = async () => {
		await vscode.commands.executeCommand('workbench.extensions.installExtension', `${publisher}.${name}`);

		await vscode.workspace.getConfiguration().update('workbench.colorTheme', themeToOpen, vscode.ConfigurationTarget.Global);
	};

	return { newThemSetting: themeToOpen, keep, undo };
}

async function findMarketPlaceExtension(publisher: string, name: string, themeName: string): Promise<any | undefined> {
	const version = await getLatestVersion(publisher, name);
	if (version === undefined) {
		vscode.window.showErrorMessage(`Unable to evaluate latest version of extension ${publisher}.${name}.`);
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


