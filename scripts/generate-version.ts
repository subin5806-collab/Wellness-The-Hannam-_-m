import fs from 'fs';
import path from 'path';

// Generate a unique version based on timestamp
const version = {
    version: Date.now().toString(),
    type: 'patch'
};

const versionPath = path.resolve(__dirname, '../public/version.json');

fs.writeFileSync(versionPath, JSON.stringify(version, null, 2));

console.log(`[Version] Generated version.json: ${version.version}`);
