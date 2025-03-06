document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Application chargée !");
    await updateSerialPortsList();
});

// 🔄 Met à jour la liste des ports COM
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
                option.textContent = `${port.path} - ${port.manufacturer || "Inconnu"}`;
                portSelect.appendChild(option);
            });
            document.getElementById('connect-btn').disabled = false; // ✅ Active le bouton connexion
        } else {
            console.warn("⚠ Aucun port COM détecté.");
            let option = document.createElement("option");
            option.textContent = "⚠ Aucun port détecté";
            option.disabled = true;
            portSelect.appendChild(option);
            document.getElementById('connect-btn').disabled = true; // ❌ Désactive le bouton connexion
        }
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des ports :", error);
    }
}

// 🎛 Connexion/Déconnexion série
document.getElementById('connect-btn').addEventListener('click', async () => {
    const portSelect = document.getElementById('ports');
    const baudRateSelect = document.getElementById('baudrate');
    const connectBtn = document.getElementById('connect-btn');

    const portName = portSelect.value;
    const baudRate = baudRateSelect.value;

    if (!portName || portName.includes("Aucun port détecté")) {
        console.warn("⚠ Aucun port série sélectionné !");
        return;
    }

    if (connectBtn.dataset.connected === "true") {
        console.log("🔌 Déconnexion en cours...");
        await window.api.connectSerialPort("", ""); // Déconnecter
        connectBtn.textContent = "🟢 Connecter";
        connectBtn.classList.remove("connected");
        connectBtn.classList.add("disconnected");
        connectBtn.dataset.connected = "false";

        // ❌ Désactiver les boutons après déconnexion
        document.getElementById('toggle-pump-btn').disabled = true;
        document.getElementById('set-rpm-btn').disabled = true;
        document.getElementById('rpm-input').disabled = true;
    } else {
        console.log(`🔗 Connexion à ${portName} (${baudRate} bauds)...`);
        const result = await window.api.connectSerialPort(portName, baudRate);
        console.log(result);

        if (result.includes("✅")) {
            connectBtn.textContent = "🔴 Déconnecter";
            connectBtn.classList.add("connected");
            connectBtn.classList.remove("disconnected");
            connectBtn.dataset.connected = "true";

            // ✅ Activer les boutons après connexion
            document.getElementById('toggle-pump-btn').disabled = false;
            document.getElementById('set-rpm-btn').disabled = false;
            document.getElementById('rpm-input').disabled = false;  
        } else {
            console.error("❌ Échec de connexion :", result);
        }
    }
});

// 🚀 Activation/Désactivation Pompe
document.getElementById('toggle-pump-btn').addEventListener('click', async () => {
    const btn = document.getElementById('toggle-pump-btn');
    const isPumpOn = btn.dataset.state === "on";

    const command = isPumpOn ? "D" : "A"; // "D" pour arrêt, "A" pour activation
    console.log(`⚙️ Envoi de la commande : ${command}`);

    const result = await window.api.sendSerialCommand(command);
    console.log(result);

    if (result.includes("✅")) {
        btn.textContent = isPumpOn ? "Activer la pompe" : "Arrêter la pompe";
        btn.classList.toggle("pump-on");
        btn.classList.toggle("pump-off");
        btn.dataset.state = isPumpOn ? "off" : "on";
    } else {
        console.error("❌ Erreur lors de l’envoi de la commande :", result);
    }
});

// ⚙️ Réglage des RPM
document.getElementById('set-rpm-btn').addEventListener('click', async () => {
    const rpmInput = document.getElementById('rpm-input');
    const rpm = rpmInput.value;

    if (isNaN(rpm) || rpm <= 0) {
        console.warn("⚠ Valeur de RPM invalide !");
        return;
    }

    console.log(`⚙️ Définition des RPM à : ${rpm}`);
    const result = await window.api.setRpm(rpm);
    console.log(result);
});
// 🎯 Permet de définir les RPM en appuyant sur "Entrée"
document.getElementById('rpm-input').addEventListener('keypress', async (event) => {
    if (event.key === "Enter") { // 📌 Vérifie si c'est bien la touche "Entrée"
        event.preventDefault();  // ❌ Empêche le comportement par défaut

        const rpmInput = document.getElementById('rpm-input');
        const rpm = rpmInput.value;

        if (isNaN(rpm) || rpm <= 0) {
            console.warn("⚠ Valeur de RPM invalide !");
            return;
        }

        console.log(`⚙️ Définition des RPM à : ${rpm} (via Entrée)`);
        const result = await window.api.setRpm(rpm);
        console.log(result);
    }
});

// 📜 Logs de la console série
function logToConsole(message) {
    const logContainer = document.getElementById('serial-output');
    const logEntry = document.createElement('p');
    logEntry.textContent = message;
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// 🎧 Écoute des données série
window.api.onSerialData((data) => {
    console.log("📩 Données reçues :", data);
    logToConsole(data);
});

// 🔄 Réinitialisation de l'interface après déconnexion
window.api.onResetPumpButton(() => {
    console.log("🔄 Réinitialisation de l'interface !");
    
    document.getElementById('toggle-pump-btn').textContent = "Activer la pompe";
    document.getElementById('toggle-pump-btn').classList.add("pump-off");
    document.getElementById('toggle-pump-btn').classList.remove("pump-on");
    document.getElementById('toggle-pump-btn').dataset.state = "off";
    document.getElementById('toggle-pump-btn').disabled = true;

    document.getElementById('connect-btn').textContent = "🟢 Connecter";
    document.getElementById('connect-btn').classList.add("disconnected");
    document.getElementById('connect-btn').classList.remove("connected");
    document.getElementById('connect-btn').dataset.connected = "false";

    document.getElementById('set-rpm-btn').disabled = true;
    document.getElementById('rpm-input').disabled = true;
});
// 🎧 Écoute la confirmation de mise à jour des RPM depuis le main process
window.api.onRpmUpdated((rpm) => {
    console.log(`🔄 RPM mis à jour dans l'UI : ${rpm}`);
    const rpmInput = document.getElementById('rpm-input');
    rpmInput.value = rpm; // ✅ Met à jour le champ de saisie
});

// 🔄 Réinitialiser le bouton de la pompe si le port série est déconnecté
window.api.onResetPumpButton(() => {
    console.log("🔄 Réinitialisation du bouton pompe après déconnexion !");
    
    const pumpButton = document.getElementById('toggle-pump-btn');
    pumpButton.textContent = "Activer la pompe";
    pumpButton.classList.add("pump-off");
    pumpButton.classList.remove("pump-on");
    pumpButton.dataset.state = "off";
    pumpButton.disabled = true; // ✅ Désactiver tant que le port série est coupé
});

// 📜 Afficher les logs reçus dans l'interface
window.api.onLogMessage((message) => {
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
        const logEntry = document.createElement('p');
        logEntry.textContent = message;
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }
    console.log(`🔍 LOG: ${message}`);
});

// 🗑 Effacer les logs
document.getElementById('clear-logs-btn').addEventListener('click', () => {
    const logContainer = document.getElementById('log-container');
    logContainer.innerHTML = ""; // Vide les logs affichés
    console.log("🗑 Logs effacés !");
});

// 📥 Télécharger les logs
document.getElementById('download-logs-btn').addEventListener('click', () => {
    const logContainer = document.getElementById('log-container');
    const logs = Array.from(logContainer.children).map(log => log.textContent).join("\n");

    if (logs.length === 0) {
        console.warn("⚠ Aucun log à télécharger !");
        return;
    }

    const blob = new Blob([logs], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'logs.txt';
    a.click();
    console.log("📥 Logs téléchargés !");
});
