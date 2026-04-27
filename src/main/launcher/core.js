// startProgressiveLaunch.js
const { Client, Authenticator } = require('minecraft-launcher-core');
const { detectJava } = require('./java'); // versão melhorada
const { MINECRAFT_DIR } = require('../main/constants');
const store = require('../store/store');
const fs = require('fs');

/**
 * Lança o jogo de forma segura e progressiva.
 * - Cria uma nova instância do Client por cada lançamento (evita acumular listeners).
 * - Resolve o javaPath de forma robusta usando detectJava() e settings.
 * - Regista handlers locais e limpa-os no fim.
 *
 * @param {string} version
 * @param {(e: any) => void} onProgress
 * @param {(e: any) => void} onLog
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function startProgressiveLaunch(version, onProgress, onLog) {
    // Garantir valores por defeito
    const account = store.get('account') || null;
    const settings = store.get('settings') || { ram: 2048 };

    // Resolver javaPath (detectJava pode devolver string ou null ou objeto)
    let javaResolved = null;
    try {
        const detected = await detectJava();
        // detectJava pode devolver string, null, ou { installed, path }
        if (!detected) {
            javaResolved = null;
        } else if (typeof detected === 'string') {
            javaResolved = detected;
        } else if (typeof detected === 'object' && detected.path) {
            javaResolved = detected.path;
        }
    } catch (e) {
        javaResolved = null;
    }

    const javaPath = (settings && settings.javaPath) ? settings.javaPath : (javaResolved || 'java');

    // Se javaPath for um ficheiro e não existir, falhar cedo
    if (javaPath !== 'java' && typeof javaPath === 'string' && !fs.existsSync(javaPath)) {
        return { success: false, error: `Caminho Java inválido: ${javaPath}` };
    }

    // Criar nova instância do client por cada chamada
    const client = new Client();

    // Preparar opções de autorização
    let authorization;
    try {
        if (account) {
            if (account.type === 'microsoft') {
                authorization = {
                    access_token: account.accessToken,
                    client_token: account.clientToken || account.client_token || account.id,
                    uuid: account.uuid,
                    name: account.username
                };
            } else {
                // Authenticator.getAuth pode lançar; capturamos abaixo
                authorization = await Authenticator.getAuth(account.username);
            }
        } else {
            authorization = await Authenticator.getAuth('Player');
        }
    } catch (authErr) {
        return { success: false, error: `Erro de autenticação: ${authErr && authErr.message ? authErr.message : authErr}` };
    }

    const opts = {
        authorization,
        root: MINECRAFT_DIR,
        version: { number: version, type: 'release' },
        memory: {
            max: `${settings.ram || 2048}M`,
            min: `${settings.minRam || 512}M`
        },
        javaPath,
        overrides: { detached: false }
    };

    // Promise que resolve quando o processo fecha ou falha
    return new Promise((resolve) => {
        // Handlers locais
        const handleData = (e) => {
            try { onLog?.(e); } catch (e) { /* ignore */ }
        };
        const handleProgress = (e) => {
            try { onProgress?.(e); } catch (e) { /* ignore */ }
        };
        const handleClose = (code) => {
            cleanup();
            if (code === 0) {
                resolve({ success: true });
            } else {
                resolve({ success: false, error: `Exit code: ${code}` });
            }
        };
        const handleError = (err) => {
            cleanup();
            resolve({ success: false, error: err && err.message ? err.message : String(err) });
        };

        // Função de limpeza de listeners
        const cleanup = () => {
            try {
                client.removeListener('data', handleData);
                client.removeListener('progress', handleProgress);
                client.removeListener('close', handleClose);
                client.removeListener('error', handleError);
                if (typeof client.removeAllListeners === 'function') {
                    // só chamar se necessário
                    // client.removeAllListeners();
                }
            } catch (e) {
                // ignore
            }
        };

        // Anexar listeners com cuidado
        try {
            client.on('data', handleData);
            client.on('progress', handleProgress);
            client.on('close', handleClose);
            client.on('error', handleError);
        } catch (attachErr) {
            cleanup();
            return resolve({ success: false, error: `Erro ao registar listeners: ${attachErr.message || attachErr}` });
        }

        // Lançar
        try {
            client.launch(opts);
        } catch (launchErr) {
            cleanup();
            return resolve({ success: false, error: `Erro ao iniciar launcher: ${launchErr && launchErr.message ? launchErr.message : launchErr}` });
        }
    });
}

module.exports = { startProgressiveLaunch };
