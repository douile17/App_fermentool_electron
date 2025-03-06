const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    listSerialPorts: () => ipcRenderer.invoke('list-serial-ports'),
    connectSerialPort: (port, baudRate) => ipcRenderer.invoke('connect-serial-port', port, baudRate),
    disconnectSerialPort: () => ipcRenderer.invoke('disconnect-serial-port'),
    sendSerialCommand: (command) => ipcRenderer.invoke('send-serial-command', command),
    setRpm: (rpm) => ipcRenderer.invoke('set-rpm', rpm),
    onPumpState: (callback) => ipcRenderer.on('pump-state', (event, state) => callback(state)),
    onResetPumpButton: (callback) => ipcRenderer.on('reset-pump-button', () => callback()),
    onPortDisconnected: (callback) => ipcRenderer.on('port-disconnected', () => callback()),

    // 📜 Ajout pour récupérer les logs
    onLogMessage: (callback) => ipcRenderer.on('log-message', (event, message) => callback(message))
});

contextBridge.exposeInMainWorld('api', {
    onRpmUpdated: (callback) => ipcRenderer.on('rpm-updated', (event, rpm) => callback(rpm))
});

contextBridge.exposeInMainWorld('api', {
    onResetPumpButton: (callback) => ipcRenderer.on('reset-pump-button', callback)
});

contextBridge.exposeInMainWorld('api', {
    onLogMessage: (callback) => ipcRenderer.on('log-message', (event, message) => callback(message))
});
