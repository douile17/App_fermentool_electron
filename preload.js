const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    listSerialPorts: () => ipcRenderer.invoke('list-serial-ports'),
    connectSerialPort: (portName, baudRate) => ipcRenderer.invoke('connect-serial-port', portName, baudRate),
    sendSerialCommand: (command) => ipcRenderer.invoke('send-serial-command', command),
    setRpm: (rpm) => ipcRenderer.invoke('set-rpm', rpm),
    onSerialData: (callback) => ipcRenderer.on('serial-data', (event, data) => callback(data)),
    onResetPumpButton: (callback) => ipcRenderer.on('reset-pump-button', callback)
});
