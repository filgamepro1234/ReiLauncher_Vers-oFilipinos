const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function detectJava() {
    try {
        if (process.env.JAVA_HOME) {
            const candidate = path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'javaw.exe' : 'java');
            if (fs.existsSync(candidate)) return candidate;
        }
    } catch (e) {}

    const candidates = [];
    if (process.platform === 'win32') {
        const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
        const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
        candidates.push(
            path.join(pf, 'Common Files', 'Oracle', 'Java', 'javapath', 'javaw.exe'),
            path.join(pf, 'Java', 'jdk-17', 'bin', 'javaw.exe'),
            path.join(pf, 'Java', 'jdk-21', 'bin', 'javaw.exe'),
            path.join(pf86, 'Common Files', 'Oracle', 'Java', 'javapath', 'javaw.exe')
        );
    } else {
        candidates.push('/usr/bin/java', '/usr/local/bin/java', '/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home/bin/java');
    }

    for (const c of candidates) {
        try { if (c && fs.existsSync(c)) return c; } catch (e) {}
    }

    try {
        if (process.platform === 'win32') {
            const out = execSync('where java', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().split(/\r?\n/)[0].trim();
            if (out && fs.existsSync(out)) return out;
        } else {
            const out = execSync('which java', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
            if (out && fs.existsSync(out)) return out;
        }
    } catch (e) {}

    try {
        execSync('java -version', { stdio: 'ignore' });
        return 'java';
    } catch (e) {}

    return null;
}

function getJavaVersion() {
    try {
        const result = spawnSync('java', ['-version'], { encoding: 'utf8' });
        const output = (result.stderr || '') + (result.stdout || '');
        const full = output.match(/version "([^"]+)"/);
        if (!full) return null;
        const versionStr = full[1];
        const major = versionStr.startsWith('1.') ? versionStr.split('.')[1] : versionStr.split('.')[0];
        return `Java ${major}`;
    } catch (e) {
        return null;
    }
}

module.exports = { detectJava, getJavaVersion };
