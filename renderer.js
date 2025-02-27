document.addEventListener('DOMContentLoaded', async () => {
    console.log("📡 Application chargée, récupération des ports...");
    await updateSerialPortsList();
});

// 🔄 Met à jour la liste des ports série
async function updateSerialPortsList() {
    try {
        const ports = await window.api.listSerialPorts();
        console.log("🔍 Ports détectés :", ports);
        
        const portSelect = document.getElementById('ports');
        portSelect.innerHTML = ""; // Vide la liste déroulante

        if (ports.length > 0) {
            ports.forEach(port => {
                let option = document.createElement("option");
                option.value = port.path;
                option.textContent = `${port.path} - ${port.manufacturer}`;
                portSelect.appendChild(option);
            });
        } else {
            let option = document.createElement("option");
            option.textContent = "⚠ Aucun port détecté";
            option.disabled = true;
            portSelect.appendChild(option);
        }
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des ports :", error);
    }
}

// 🎛 Gestion de la connexion série
document.getElementById('connect-btn').addEventListener('click', async () => {
    const portSelect = document.getElementById('ports');
    const baudRateSelect = document.getElementById('baudrate');
    const connectBtn = document.getElementById('connect-btn');

    const portName = portSelect.value;
    const baudRate = baudRateSelect.value;

    if (!portName) {
        console.warn("⚠ Aucun port sélectionné !");
        return;
    }

    console.log(`🔗 Tentative de connexion à ${portName} (${baudRate} bauds)...`);
    const result = await window.api.connectSerialPort(portName, baudRate);
    
    if (result.includes("✅")) {
        connectBtn.textContent = "🔴 Déconnecter";
        connectBtn.classList.remove('disconnected');
        connectBtn.classList.add('connected');
        connectBtn.dataset.connected = "true";
    } else {
        console.error("❌ Échec de connexion :", result);
    }
});

// 🚀 Activation/Désactivation de la pompe
document.getElementById('toggle-pump-btn').addEventListener('click', async () => {
    const btn = document.getElementById('toggle-pump-btn');
    const isPumpOn = btn.dataset.state === "on";

    const command = isPumpOn ? "D" : "A"; // "D" pour arrêter, "A" pour activer
    const result = await window.api.sendSerialCommand(command);
    
    if (result.includes("✅")) {
        btn.textContent = isPumpOn ? "Activer la pompe" : "Arrêter la pompe";
        btn.classList.toggle("pump-on");
        btn.classList.toggle("pump-off");
        btn.dataset.state = isPumpOn ? "off" : "on";
    } else {
        console.error("❌ Erreur lors de l'envoi de la commande :", result);
    }
});

// ⚙️ Réglage des RPM
document.getElementById('set-rpm-btn').addEventListener('click', async () => {
    const rpmInput = document.getElementById('rpm-input');
    const rpm = rpmInput.value;

    if (isNaN(rpm) || rpm <= 0) {
        console.warn("⚠ RPM invalide !");
        return;
    }

    console.log(`⚙️ Définition des RPM à : ${rpm}`);
    const result = await window.api.setRpm(rpm);
    
    if (!result.includes("✅")) {
        console.error("❌ Erreur lors du réglage des RPM :", result);
    }
});

// 📜 Gestion de la console des logs
function logToConsole(message) {
    const logContainer = document.getElementById('serial-output');
    const logEntry = document.createElement('p');
    logEntry.textContent = message;
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

document.getElementById('clear-logs-btn').addEventListener('click', () => {
    document.getElementById('serial-output').innerHTML = "";
});

document.getElementById('download-logs-btn').addEventListener('click', () => {
    const logContainer = document.getElementById('serial-output');
    const logs = logContainer.textContent;
    const blob = new Blob([logs], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "logs.txt";
    a.click();
});

// 🎧 Écoute des données série
window.api.onSerialData((data) => {
    console.log("📩 Données reçues :", data);
    logToConsole(data);
});

// 🔄 Réinitialisation de l'interface après déconnexion
window.api.onResetPumpButton(() => {
    document.getElementById('toggle-pump-btn').textContent = "Activer la pompe";
    document.getElementById('toggle-pump-btn').classList.add("pump-off");
    document.getElementById('toggle-pump-btn').classList.remove("pump-on");
    document.getElementById('toggle-pump-btn').dataset.state = "off";

    document.getElementById('connect-btn').textContent = "🟢 Connecter";
    document.getElementById('connect-btn').classList.add("disconnected");
    document.getElementById('connect-btn').classList.remove("connected");
    document.getElementById('connect-btn').dataset.connected = "false";
});
