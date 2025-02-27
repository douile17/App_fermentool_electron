const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { SerialPort } = require('serialport'); // 📌 Correct import de SerialPort
const path = require('path');

let mainWindow;
let serialConnection = null;

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
        event.preventDefault();
        const choice = dialog.showMessageBoxSync(mainWindow, {
            type: 'warning',
            buttons: ['Non', 'Oui'],
            defaultId: 0,
            title: 'Confirmation',
            message: 'Voulez-vous vraiment quitter l’application ?',
            noLink: true
        });

        if (choice === 1) {
            if (serialConnection && serialConnection.isOpen) {
                serialConnection.close(() => {
                    mainWindow.webContents.send('pump-state', false);
                    mainWindow.webContents.send('reset-pump-button');
                    mainWindow.destroy();
                    app.quit();
                });
            } else {
                mainWindow.destroy();
                app.quit();
            }
        }
    });
}

// 🔍 Récupération des ports série avec logs détaillés
ipcMain.handle('list-serial-ports', async () => {
    try {
        console.log("🔍 Recherche des ports série...");
        const ports = await SerialPort.list();
        console.log("✅ Ports détectés :", ports);
        return ports.map(port => ({
            path: port.path,
            manufacturer: port.manufacturer || "Inconnu",
            friendlyName: port.friendlyName || "Non spécifié"
        }));
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des ports :", error);
        return [];
    }
});

// 🟢 Connexion à un port série
ipcMain.handle('connect-serial-port', async (event, portName, baudRate) => {
    try {
        if (serialConnection && serialConnection.isOpen) {
            serialConnection.close();
            serialConnection = null;
            mainWindow.webContents.send('pump-state', false);
            mainWindow.webContents.send('reset-pump-button');
        }

        if (!portName) {
            mainWindow.webContents.send('pump-state', false);
            mainWindow.webContents.send('reset-pump-button');
            return "❌ Aucun port sélectionné.";
        }

        serialConnection = new SerialPort({
            path: portName,
            baudRate: parseInt(baudRate),
            autoOpen: false
        });

        serialConnection.open((err) => {
            if (err) {
                console.error("❌ Erreur d'ouverture :", err.message);
                return;
            }
            console.log(`✅ Connecté à ${portName} (${baudRate} bauds)`);
            setTimeout(() => serialConnection.write("\n"), 100);
        });

        serialConnection.on('close', () => {
            mainWindow.webContents.send('pump-state', false);
            mainWindow.webContents.send('reset-pump-button');
        });

        return `✅ Connecté à ${portName} (${baudRate} bauds)`;
    } catch (error) {
        return `❌ Erreur : ${error.message}`;
    }
});

// ✉️ Envoi d'une commande série
ipcMain.handle('send-serial-command', async (event, command) => {
    if (!serialConnection || !serialConnection.isOpen) return "❌ Aucun port série connecté.";
    try {
        serialConnection.write(command + '\n');
        return `✅ Commande envoyée : ${command}`;
    } catch (error) {
        return `❌ Erreur : ${error.message}`;
    }
});

app.whenReady().then(createWindow);
