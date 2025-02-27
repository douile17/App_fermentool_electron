const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const serialport = require('serialport');
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
                serialConnection.write("D", (err) => {
                    if (err) console.error("Erreur d'arrêt :", err.message);
                    setTimeout(() => {
                        serialConnection.close(() => {
                            mainWindow.webContents.send('pump-state', false);
                            mainWindow.webContents.send('reset-pump-button');
                            mainWindow.destroy();
                            app.quit();
                        });
                    }, 500);
                });
            } else {
                mainWindow.destroy();
                app.quit();
            }
        } else {
            console.log("❌ Annulation de la fermeture, l'application reste ouverte.");
        }
    });
}

ipcMain.handle('list-serial-ports', async () => {
    try {
        const ports = await serialport.SerialPort.list();
        return ports.map(port => ({
            path: port.path,
            manufacturer: port.manufacturer || "Inconnu",
            friendlyName: port.friendlyName || "Non spécifié"
        }));
    } catch (error) {
        console.error("Erreur ports COM :", error);
        return [];
    }
});

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

        serialConnection = new serialport.SerialPort({
            path: portName,
            baudRate: parseInt(baudRate),
            autoOpen: false
        });

        serialConnection.open((err) => {
            if (err) return console.error("Erreur d'ouverture :", err.message);
            console.log(`✅ Connecté à ${portName} avec ${baudRate} bauds`);
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

ipcMain.handle('send-serial-command', async (event, command) => {
    if (!serialConnection || !serialConnection.isOpen) return "❌ Aucun port série connecté.";
    try {
        serialConnection.write(command + '\n');
        if (command === 'D') {
            mainWindow.webContents.send('pump-state', false);
            mainWindow.webContents.send('reset-pump-button');
        } else if (command === 'A') {
            mainWindow.webContents.send('pump-state', true);
        }
        return `✅ Commande envoyée : ${command}`;
    } catch (error) {
        return `❌ Erreur : ${error.message}`;
    }
});

ipcMain.handle('set-rpm', async (event, rpm) => {
    if (!serialConnection || !serialConnection.isOpen) return "❌ Aucun port série connecté.";
    try {
        const rpmFloat = parseFloat(rpm);
        if (isNaN(rpmFloat) || rpmFloat < 0) return "❌ Valeur de RPM invalide.";

        const buffer = Buffer.alloc(4);
        buffer.writeFloatLE(rpmFloat, 0);
        serialConnection.write(Buffer.from('R'));
        serialConnection.write(buffer);
        return `✅ RPM défini à ${rpmFloat}`;
    } catch (error) {
        return `❌ Erreur : ${error.message}`;
    }
});

app.whenReady().then(createWindow);
