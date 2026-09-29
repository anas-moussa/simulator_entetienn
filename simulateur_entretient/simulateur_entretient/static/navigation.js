// navigation.js : bascule entre l'accueil et les 4 espaces.
// Le panneau caméra est DÉPLACÉ (jamais recréé) : la vidéo garde son flux actif.

const panneauCamera = document.getElementById("panneau-camera");

function placerPanneauCamera(idEcran) {
  if (idEcran === "section-camera") {
    document.getElementById("ancre-camera-test").appendChild(panneauCamera);
  } else if (idEcran === "section-entretien") {
    document.getElementById("ancre-camera-entretien").appendChild(panneauCamera);
  }
  // Pour les autres écrans, on laisse le panneau où il est (cause de laquelle
  // on ne le range nulle part) : il continue de tourner en arrière-plan.
}

// Au chargement, on met le panneau dans le premier écran qui l'utilisera
placerPanneauCamera("section-camera");

document.addEventListener("click", function (evenement) {
  const carte = evenement.target.closest(".porte");
    if (carte) {
    document.getElementById("ecran-accueil").hidden = true;
    document.getElementById(carte.dataset.cible).hidden = false;
    placerPanneauCamera(carte.dataset.cible);
  }
  if (evenement.target.classList.contains("btn-retour")) {
    document.querySelectorAll(".section-app").forEach(function (s) { s.hidden = true; });
    document.getElementById("ecran-accueil").hidden = false;
  }
});