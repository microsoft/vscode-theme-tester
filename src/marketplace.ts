
import { xhr } from 'request-light';


export async function getLatestVersion(publisher: string, name: string): Promise<string | undefined> {
    try {
        const data = `{"filters":[{"criteria":[{"filterType":8,"value":"Microsoft.VisualStudio.Code"},{"filterType":7,"value":"${publisher}.${name}"}]}],"flags":0x200}`;

        const res = await xhr({
            url: 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery',
            type: 'post',
            data: data,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            headers: { 'accept': 'application/json;api-version=3.0-preview.1', 'content-type': 'application/json', 'X-Market-Client-Id': 'vscode-marketplace-extension-browser' }
        });
        if (res.status === 200) {
            const data = JSON.parse(res.responseText);
            if (Array.isArray(data?.results) && Array.isArray(data.results[0].extensions) && Array.isArray(data.results[0].extensions[0].versions)) {
                const versions = data.results[0].extensions[0].versions;
                if (Array.isArray(versions) && versions.length) {
                    return versions[0].version;
                }
            }
        }
    } catch (e) {
        console.log(e);
    }
    return undefined;
}

export interface Manifest {
    browser?: string;
    main?: string;
    contributes?: {
        themes?: [
            {
                label?: string;
                path: string;
                uiTheme: string;
            }

        ];
    };
}


export async function fetchPackageJSON(publisher: string, name: string, version: string): Promise<any | undefined> {

    const url = getUnpkgURL(publisher, name, version, '/extension/package.json');
    const headers = {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'X-Client-Name': `theme-tester`
    };
    const res = await xhr({ url, headers });
    if (res.status >= 200 && res.status <= 204) {
        try {
            return JSON.parse(res.responseText);
        } catch (e) {
            throw new Error(`Problem parsing ${url}`);
        }
    }
    throw new Error(`Problem accessing ${url}`);

}

function getUnpkgURL(publisher: string, name: string, version: string, path: string) {
    return `https://${publisher}.vscode-unpkg.net/${publisher}/${name}/${version}${path}`;
}