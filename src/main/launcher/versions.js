const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function getRemoteVersions() {
    try {
        const response = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest.json');
        return response.data.versions
            .filter(v => v.type === 'release')
            .map(v => v.id);
    } catch (error) {
        console.error("Erro ao procurar versões:", error);
        return ['1.21.4', '1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.17.1', '1.16.5', '1.8.9'];
    }
}

function getDirSize(dirPath) {
    let size = 0;
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dirPath, entry.name);
            try {
                if (entry.isDirectory()) {
                    size += getDirSize(full);
                } else if (entry.isFile()) {
                    size += fs.statSync(full).size;
                }
            } catch (e) { /* ignore locked files */ }
        }
    } catch (e) {}
    return size;
}

function detectVersionType(name) {
    const n = name.toLowerCase();
    if (n.includes('fabric')) return 'Fabric';
    if (n.includes('forge')) return 'Forge';
    if (n.includes('quilt')) return 'Quilt';
    if (n.includes('neoforge')) return 'NeoForge';
    if (n.includes('optifine')) return 'OptiFine';
    return 'Vanilla';
}

function getInstalledVersions(minecraftDir) {
    const versionsDir = path.join(minecraftDir, 'versions');
    if (!fs.existsSync(versionsDir)) return [];
    try {
        return fs.readdirSync(versionsDir, { withFileTypes: true })
            .filter(e => e.isDirectory())
            .map(e => {
                const versionDir = path.join(versionsDir, e.name);
                const size = getDirSize(versionDir);
                const type = detectVersionType(e.name);
                return { id: e.name, type, size, installed: true };
            })
            .sort((a, b) => b.size - a.size);
    } catch (e) {
        return [];
    }
}

module.exports = { getRemoteVersions, getInstalledVersions };