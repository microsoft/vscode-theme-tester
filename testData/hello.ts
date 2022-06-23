
import { promises as fs } from 'fs';

export class Store {
    constructor() {
    }

    async foo() {
        const buffer = await fs.readFile('test.yaml', 'utf-8');
        return buffer.substr(0, buffer.length);
    }
}