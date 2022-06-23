/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, Uri, FileType, workspace, Disposable, WorkspaceEdit, Position, window, ViewColumn, commands } from 'vscode';
import { Utils } from 'vscode-uri';
import { File, Directory, Entry, MemFileSystemProvider } from './memFsProvider';
import { getProductName } from './themeTesterMain';

export const SCHEME = 'vscode-theme-tester';

export function registerPlayground(playgroundFolder: Uri): Disposable {
	const serverBackedRootDirectory = new ServerBackedDirectory(playgroundFolder, '');
	return workspace.registerFileSystemProvider(SCHEME, new MemFileSystemProvider(SCHEME, serverBackedRootDirectory));
}

class ServerBackedFile implements File {
	readonly type = FileType.File;
	readonly stats = Promise.resolve({ type: FileType.File, ctime: Date.now(), mtime: Date.now(), size: 0 });
	private _content: Promise<Uint8Array> | undefined;
	constructor(private readonly _serverUri: Uri, public name: string) {
	}
	get content(): Promise<Uint8Array> {
		if (this._content === undefined) {
			this._content = Promise.resolve(workspace.fs.readFile(this._serverUri));
		}
		return this._content;
	}
	set content(content: Promise<Uint8Array>) {
		this._content = content;
	}
}

class ServerBackedDirectory implements Directory {
	readonly type = FileType.Directory;
	readonly stats = Promise.resolve({ type: FileType.Directory, ctime: Date.now(), mtime: Date.now(), size: 0 });
	private _entries: Promise<Map<string, Entry>> | undefined;
	constructor(private readonly _serverUri: Uri, public name: string) {
	}
	get entries(): Promise<Map<string, Entry>> {
		if (this._entries === undefined) {
			this._entries = getEntries(this._serverUri);
		}
		return this._entries;
	}
	set entries(entries: Promise<Map<string, Entry>>) {
		this._entries = entries;
	}
}


function isDirEntry(e: any): e is [string, FileType] {
	return Array.isArray(e) && e.length === 2 && typeof e[0] === 'string' && typeof e[1] === 'number';
}

async function getEntries(contentUri: Uri): Promise<Map<string, Entry>> {
	const result = new Map();
	try {
		const dirInfo = await workspace.fs.readFile(Utils.joinPath(contentUri, 'dirinfo.json'));
		const entries = JSON.parse(new TextDecoder().decode(dirInfo));
		if (Array.isArray(entries)) {
			for (const r of entries) {
				if (isDirEntry(r)) {
					const type = r[1] === FileType.Directory ? FileType.Directory : FileType.File;
					const childContentPath = Utils.joinPath(contentUri, r[0]);
					const newEntry: Entry = type === FileType.Directory ? new ServerBackedDirectory(childContentPath, r[0]) : new ServerBackedFile(childContentPath, r[0]);
					result.set(newEntry.name, newEntry);
				}
			}
			return result;
		}
	} catch (e) {
		console.log(`readDirectory error`, e);
		// ignore
	}
	return result;
}

export async function openEditors(themeSettingName: string) {
	await commands.executeCommand('workbench.action.closeAllEditors');

	const readmeURI = Uri.parse(`${SCHEME}:/readme.md`);
	const helloTs = Uri.parse(`${SCHEME}:/hello.ts`);
	const packageJSON = Uri.parse(`${SCHEME}:/package.json`);

	// add a header
	const doc = await workspace.openTextDocument(readmeURI);
	const edit = new WorkspaceEdit();
	edit.insert(readmeURI, new Position(0, 0), `# ${themeSettingName}\n\nThis is the *${themeSettingName}* theme in **${getProductName()}**!\n\n---\n\n`);
	await workspace.applyEdit(edit);
	await doc.save();

	await window.showTextDocument(doc);

	await window.showTextDocument(await workspace.openTextDocument(helloTs), { viewColumn: ViewColumn.Two });
	await commands.executeCommand('workbench.action.splitEditorDown');
	await window.showTextDocument(await workspace.openTextDocument(packageJSON), { viewColumn: ViewColumn.Two });

	await commands.executeCommand('workbench.explorer.fileView.focus');
}