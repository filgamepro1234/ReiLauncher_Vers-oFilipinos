const { Client, Authenticator } = require('minecraft-launcher-core');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { detectJava } = require('./java');
const store = require('../store/store');

const MINECRAFT_DIR = path.join(app.getPath('userData'), '.rei-launcher');

/**
 * Tenta detetar Java de forma cross-platform:
 * 1) Usa detectJava() se existir (módulo separado).
 * 2) Verifica JAVA_HOME.
 * 3) Procura caminhos comuns no Windows.
 * 4) Tenta 'which java' / 'where java'.
 * 5) Fallback para 'java' (comando global).
 */
async function resolveJavaPath(settingsJavaPath) {
    // 1) Módulo detectJava (se disponível)
    try {
        const detected = await detectJava?.();
        if (detected && typeof detected === 'string' && fs.existsSync(detected)) {
            return detected;
        }
    } catch (e) {
        // ignore and fallback
    }

    // 2) Se o utilizador já forneceu um caminho válido nas settings
    if (settingsJavaPath && settingsJavaPath !== 'java' && fs.existsSync(settingsJavaPath)) {
        return settingsJavaPath;
    }

    // 3) JAVA_HOME
    if (process.env.JAVA_HOME) {
        const candidate = path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'javaw.exe' : 'java');
        if (fs.existsSync(candidate)) return candidate;
    }

    // 4) Caminhos comuns no Windows
    if (process.platform === 'win32') {
        const commonPaths = [
            path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Common Files', 'Oracle', 'Java', 'javapath', 'javaw.exe'),
            path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Java', 'jdk-17', 'bin', 'javaw.exe'),
            path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Java', 'jdk-21', 'bin', 'javaw.exe'),
            path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Common Files', 'Oracle', 'Java', 'javapath', 'javaw.exe')
        ];
        for (const p of commonPaths) {
            if (p && fs.existsSync(p)) return p;
        }
        // tentar 'where java' no Windows
        try {
            const whereOut = execSync('where java', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().split(/\r?\n/)[0].trim();
            if (whereOut && fs.existsSync(whereOut)) return whereOut;
        } catch (e) {
            // ignore
        }
    } else {
        // 5) POSIX: tentar 'which java'
        try {
            const whichOut = execSync('which java', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
            if (whichOut && fs.existsSync(whichOut)) return whichOut;
        } catch (e) {
            // ignore
        }
        // macOS: procurar javaw em /usr/bin/java ou /usr/local/bin/java
        const posixCandidates = ['/usr/bin/java', '/usr/local/bin/java'];
        for (const p of posixCandidates) {
            if (fs.existsSync(p)) return p;
        }
    }

    // 6) fallback para comando global 'java' (deixa o sistema resolver)
    return 'java';
}

/**
 * Lança o jogo numa nova instância do Client por chamada.
 * onProgress(e) e onLog(e) são callbacks opcionais fornecidos pelo caller.
 */
async function launchGame(version, onProgress, onLog) {
    // Criar nova instância por cada lançamento evita acumular listeners
    const client = new Client();

    return new Promise(async (resolve, reject) => {
        // Helper para limpar listeners/recursos
        const cleanup = () => {
            try {
                // remover listeners específicos se existirem
                if (typeof client.removeAllListeners === 'function') {
                    client.removeAllListeners();
                }
            } catch (e) {
                // ignore
            }
        };

        try {
            const account = store.get('account');
            const settings = store.get('settings') || { ram: 4096 };

            // Resolver caminho do java de forma robusta
            const javaPath = await resolveJavaPath(settings.javaPath);

            // Se o caminho for um ficheiro e não existir, falhar cedo
            if (javaPath !== 'java' && typeof javaPath === 'string' && !fs.existsSync(javaPath)) {
                cleanup();
                return reject(new Error(`Caminho Java inválido: ${javaPath}`));
            }

            // Autenticação
            let auth;
            if (account) {
                if (account.type === 'microsoft') {
                    auth = {
                        access_token: account.accessToken,
                        client_token: account.clientToken,
                        uuid: account.uuid,
                        name: account.username
                    };
                } else {
                    // Authenticator.getAuth pode lançar
                    auth = await Authenticator.getAuth(account.username);
                }
            } else {
                auth = await Authenticator.getAuth('Player');
            }

            const opts = {
                authorization: auth,
                root: MINECRAFT_DIR,
                version: { number: version, type: 'release' },
                memory: {
                    max: `${settings.ram}M`,
                    min: '1024M'
                },
                javaPath
            };

            // ✅ FIX: Nomes distintos para não fazer shadow dos parâmetros da função
            const handleData = (e) => {
                try { onLog?.(e); } catch (_) { /* ignore */ }
            };
            const handleProgress = (e) => {
                try { onProgress?.(e); } catch (_) { /* ignore */ }
            };
            const handleClose = (code) => {
                cleanup();
                if (code === 0) {
                    return resolve({ success: true, code: 0 });
                } else {
                    return resolve({ success: false, error: `Exit code: ${code}` });
                }
            };
            const handleError = (err) => {
                cleanup();
                return resolve({ success: false, error: err && err.message ? err.message : String(err) });
            };

            try {
                client.on('data', handleData);
                client.on('progress', handleProgress);
                client.on('close', handleClose);
                client.on('error', handleError);
            } catch (attachErr) {
                // Se a API do client não suportar .on, limpar e rejeitar
                cleanup();
                return reject(attachErr);
            }

            // Iniciar o launcher
            try {
                client.launch(opts);
            } catch (launchErr) {
                cleanup();
                return reject(launchErr);
            }
        } catch (err) {
            // Erro inesperado durante preparação
            try { client.removeAllListeners(); } catch (e) { /* ignore */ }
            return reject(err);
        }
    });
}

module.exports = { launchGame };
