const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { SerialPort } = require('serialport');
const path = require('path');

let mainWindow;
let serialConnection = null;
let pumpState = false; // État de la pompe
let isQuitting = false; // 🚨 Empêche la fermeture multiple

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.on('close', async (event) => {
        if (!isQuitting) {
            event.preventDefault();
            isQuitting = true; // 🔒 Empêcher les fermetures multiples
            
            const choice = dialog.showMessageBoxSync(mainWindow, {
                type: 'warning',
                buttons: ['Non', 'Oui'],
                defaultId: 0,
                title: 'Confirmation',
                message: 'Voulez-vous vraiment quitter l’application ?',
                noLink: true
            });

            if (choice === 1) {
                await stopPumpAndQuit();
            } else {
                isQuitting = false; // 🔓 Autoriser une nouvelle fermeture
            }
        }
    });
}

// ✅ Fonction pour afficher les logs dans l'interface
function logMessage(message) {
    console.log(`📝 LOG: ${message}`);
    if (mainWindow) {
        mainWindow.webContents.send('log-message', message);
    }
}

// 🛑 Arrêter la pompe avant de fermer l'application (une seule fois !)
async function stopPumpAndQuit() {
    logMessage("🔴 Fermeture de l'application, arrêt de la pompe...");

    if (serialConnection && serialConnection.isOpen && pumpState) {
        serialConnection.write("D", (err) => {
            if (err) logMessage(`❌ Erreur d'arrêt de la pompe : ${err.message}`);
        });

        await new Promise(resolve => setTimeout(resolve, 500)); // ⏳ Attendre l'envoi
    }

    if (serialConnection && serialConnection.isOpen) {
        serialConnection.close();
    }

    app.quit();
}

// 🔍 Récupération des ports série
ipcMain.handle('list-serial-ports', async () => {
    try {
        logMessage("🔍 Recherche des ports série...");
        const ports = await SerialPort.list();
        logMessage(`✅ Ports détectés : ${JSON.stringify(ports)}`);
        return ports.map(port => ({
            path: port.path,
            manufacturer: port.manufacturer || "Inconnu",
            friendlyName: port.friendlyName || "Non spécifié"
        }));
    } catch (error) {
        logMessage(`❌ Erreur lors de la récupération des ports : ${error.message}`);
        return [];
    }
});

// 🟢 Connexion à un port série
ipcMain.handle('connect-serial-port', async (event, portName, baudRate) => {
    try {
        if (serialConnection && serialConnection.isOpen) {
            await disconnectSerialPort();
        }

        if (!portName) {
            return "❌ Aucun port sélectionné.";
        }

        serialConnection = new SerialPort({
            path: portName,
            baudRate: parseInt(baudRate),
            autoOpen: false
        });

        serialConnection.open((err) => {
            if (err) {
                logMessage(`❌ Erreur d'ouverture : ${err.message}`);
                return;
            }
            logMessage(`✅ Connecté à ${portName} (${baudRate} bauds)`);
            setTimeout(() => serialConnection.write("\n"), 100);

            serialConnection.on('close', async () => {
                logMessage("🔴 Port série déconnecté, arrêt automatique de la pompe !");
                await disconnectSerialPort();
            });
        });

        return `✅ Connecté à ${portName} (${baudRate} bauds)`;
    } catch (error) {
        return `❌ Erreur : ${error.message}`;
    }
});

// 🛑 Déconnexion manuelle du port série
ipcMain.handle('disconnect-serial-port', async () => {
    return await disconnectSerialPort();
});

// 🛠 Fonction pour arrêter la pompe et fermer proprement le port série
async function disconnectSerialPort() {
    if (serialConnection && serialConnection.isOpen) {
        logMessage("🔴 Déconnexion demandée, arrêt de la pompe...");
        
        serialConnection.write("D", (err) => {
            if (err) logMessage(`❌ Erreur d'arrêt de la pompe : ${err.message}`);
        });

        await new Promise(resolve => setTimeout(resolve, 500)); 

        serialConnection.close();
    }

    serialConnection = null;
    pumpState = false;
    mainWindow.webContents.send('pump-state', false);
    mainWindow.webContents.send('reset-pump-button');  
    mainWindow.webContents.send('port-disconnected');  

    return "✅ Port série déconnecté proprement et pompe arrêtée.";
}

// 🛠 Envoi d'une commande série (Activation/Désactivation de la pompe)
ipcMain.handle('send-serial-command', async (event, command) => {
    if (!serialConnection || !serialConnection.isOpen) return "❌ Aucun port série connecté.";

    try {
        serialConnection.write(command + '\n');
        logMessage(`📤 Commande envoyée : ${command}`);

        if (command === 'D') {
            pumpState = false;
            mainWindow.webContents.send('pump-state', false);
        } else if (command === 'A') {
            pumpState = true;
        }
        return `✅ Commande envoyée : ${command}`;
    } catch (error) {
        logMessage(`❌ Erreur d'envoi de commande : ${error.message}`);
        return `❌ Erreur : ${error.message}`;
    }
});

// ⚙️ Réglage des RPM
ipcMain.handle('set-rpm', async (event, rpm) => {
    if (!serialConnection || !serialConnection.isOpen) {
        return "❌ Aucun port série connecté.";
    }

    try {
        const rpmFloat = parseFloat(rpm);
        if (isNaN(rpmFloat) || rpmFloat <= 0) {
            return "❌ Valeur de RPM invalide.";
        }

        if (!serialConnection.writable) {
            return "❌ Le port série n'est pas prêt.";
        }

        const buffer = Buffer.alloc(4);
        buffer.writeFloatLE(rpmFloat, 0);
        serialConnection.write(Buffer.from('R'));
        serialConnection.write(buffer, (err) => {
            if (err) {
                logMessage(`❌ Erreur d'envoi des RPM : ${err.message}`);
                return;
            }
            logMessage(`✅ RPM défini à ${rpmFloat}`);
            mainWindow.webContents.send('rpm-updated', rpmFloat);
        });

        return `✅ RPM défini à ${rpmFloat}`;
    } catch (error) {
        logMessage(`❌ Erreur lors du réglage des RPM : ${error.message}`);
        return `❌ Erreur : ${error.message}`;
    }
});


app.whenReady().then(createWindow);
app.on('before-quit', async () => {
    await stopPumpAndQuit();
});
