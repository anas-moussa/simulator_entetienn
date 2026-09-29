// historique.js : enregistre, affiche, graphique et conseils récurrents

const btnHistorique = document.getElementById("btn-historique");
const btnEffacerTout = document.getElementById("btn-effacer-tout");
const zoneHistorique = document.getElementById("zone-historique");

async function enregistrerHistorique(resultat) {
  try {
    await fetch("/api/historique", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entreprise: entrepriseChoisie ? entrepriseChoisie.nom : "",
        langue: selectLangue ? selectLangue.value : "",
        note: resultat.note20,
        decision: resultat.decision,
        arret: !!resultat.arret,
        conseils: resultat.conseils || []
      })
    });
  } catch (erreur) {
    console.log("Historique non enregistré : " + erreur.message);
  }
}

async function chargerEtAfficherHistorique() {
  zoneHistorique.textContent = "Chargement…";
  try {
    const reponse = await fetch("/api/historique");
    const lignes = await reponse.json();
    afficherHistorique(lignes);
    remplirFiltreEntreprises(lignes);
    dessinerGraphique(filtrerParEntreprise(lignes));
    afficherRepetitions(lignes);
  } catch (erreur) {
    zoneHistorique.textContent = "Erreur : " + erreur.message;
  }
}

function afficherHistorique(lignes) {
  if (lignes.length === 0) {
    zoneHistorique.textContent = "Aucun entretien enregistré pour l'instant.";
    return;
  }
  let html = "<table style='margin:10px auto; border-collapse:collapse; width:100%;'>";
  html += "<tr><th style='padding:6px 10px;'>Date</th><th style='padding:6px 10px;'>Entreprise</th>" +
          "<th style='padding:6px 10px;'>Note</th><th style='padding:6px 10px;'>Décision</th><th></th></tr>";
  for (const l of lignes) {
    const arret = l.arret ? " (arrêt anticipé)" : "";
    html += "<tr style='border-top:1px solid #eee;'>" +
            "<td style='padding:6px 10px;'>" + l.date_heure + "</td>" +
            "<td style='padding:6px 10px;'>" + (l.entreprise || "—") + "</td>" +
            "<td style='padding:6px 10px;'>" + l.note + " / 20</td>" +
            "<td style='padding:6px 10px;'>" + l.decision + arret + "</td>" +
            "<td><button class='btn-effacer-ligne' data-id='" + l.id + "' " +
            "style='background:#b23b3b; padding:4px 8px; font-size:12px;'>✖</button></td></tr>";
  }
  html += "</table>";
  zoneHistorique.innerHTML = html;
}
let dernieresLignes = [];   // pour redessiner le graphique quand on change de filtre

function remplirFiltreEntreprises(lignes) {
  dernieresLignes = lignes;
  const select = document.getElementById("filtre-entreprise-historique");
  if (!select) return;
  const valeurActuelle = select.value;
  const noms = Array.from(new Set(lignes.map(function (l) { return l.entreprise; }).filter(Boolean)));

  select.innerHTML = '<option value="">Toutes les entreprises</option>';
  for (const nom of noms) {
    const option = document.createElement("option");
    option.value = nom;
    option.textContent = nom;
    select.appendChild(option);
  }
  select.value = valeurActuelle;   // on garde le choix précédent si possible
}

function filtrerParEntreprise(lignes) {
  const select = document.getElementById("filtre-entreprise-historique");
  const choix = select ? select.value : "";
  return choix ? lignes.filter(function (l) { return l.entreprise === choix; }) : lignes;
}

// Redessine le graphique quand on change le filtre
document.addEventListener("change", function (evenement) {
  if (evenement.target.id === "filtre-entreprise-historique") {
    dessinerGraphique(filtrerParEntreprise(dernieresLignes));
  }
});

// Un petit graphique en ligne (note par session), dessiné directement au canevas
function dessinerGraphique(lignes) {
  const canvas = document.getElementById("graphique-historique");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  if (lignes.length < 2) {
    ctx.fillStyle = "#8a8060";
    ctx.font = "13px Georgia";
    ctx.fillText("Fais au moins 2 entretiens pour voir ta progression ici.", 20, H / 2);
    return;
  }

  // Du plus ancien au plus récent (la base renvoie l'inverse)
  const donnees = lignes.slice().reverse();

  const marge = { gauche: 44, droite: 16, haut: 16, bas: 26 };
  const largeurUtile = W - marge.gauche - marge.droite;
  const hauteurUtile = H - marge.haut - marge.bas;

  // Lignes horizontales de repère (0, 5, 10, 15, 20)
  ctx.strokeStyle = "#ddd6c0";
  ctx.fillStyle = "#6b6248";
  ctx.font = "11px Georgia";
  for (let n = 0; n <= 20; n += 5) {
    const y = marge.haut + hauteurUtile - (n / 20) * hauteurUtile;
    ctx.beginPath();
    ctx.moveTo(marge.gauche, y);
    ctx.lineTo(W - marge.droite, y);
    ctx.stroke();
    ctx.fillText(n + "/20", 2, y + 4);
  }

  // La ligne de progression
  const pas = largeurUtile / (donnees.length - 1);
  ctx.strokeStyle = "#7a2f3a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  donnees.forEach(function (l, i) {
    const x = marge.gauche + i * pas;
    const y = marge.haut + hauteurUtile - (l.note / 20) * hauteurUtile;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Un point par session, avec le numéro de session en dessous
  ctx.fillStyle = "#7a2f3a";
  donnees.forEach(function (l, i) {
    const x = marge.gauche + i * pas;
    const y = marge.haut + hauteurUtile - (l.note / 20) * hauteurUtile;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6b6248";
    ctx.fillText("S" + (i + 1), x - 8, H - 6);
    ctx.fillStyle = "#7a2f3a";
  });
}

// Compte les conseils qui reviennent au moins 2 fois dans les derniers entretiens
function afficherRepetitions(lignes) {
  const zone = document.getElementById("repetitions-historique");
  if (!zone) return;

  const compte = {};
  for (const l of lignes) {
    for (const c of (l.conseils || [])) {
      compte[c] = (compte[c] || 0) + 1;
    }
  }

  const tries = Object.entries(compte)
    .filter(function (x) { return x[1] >= 2; })
    .sort(function (a, b) { return b[1] - a[1]; })
    .slice(0, 5);

  if (tries.length === 0) {
    zone.innerHTML = "";
    return;
  }

  let html = "<h3>Ce qui revient souvent</h3><ul>";
  for (const paire of tries) {
    html += "<li>" + paire[0] + " <em>(" + paire[1] + " fois)</em></li>";
  }
  html += "</ul>";
  zone.innerHTML = html;
}

if (btnHistorique) btnHistorique.addEventListener("click", chargerEtAfficherHistorique);

if (btnEffacerTout) {
  btnEffacerTout.addEventListener("click", async function () {
    if (!confirm("Effacer tout ton historique ? Cette action est définitive.")) return;
    await fetch("/api/historique", { method: "DELETE" });
    chargerEtAfficherHistorique();
  });
}

zoneHistorique.addEventListener("click", async function (evenement) {
  const bouton = evenement.target.closest(".btn-effacer-ligne");
  if (!bouton) return;
  await fetch("/api/historique/" + bouton.dataset.id, { method: "DELETE" });
  chargerEtAfficherHistorique();
});