<?php
// Réglages communs du Piano Virtuel Pédagogique.
const APP_NAME = 'Piano Virtuel Pédagogique';

/** Échappe une valeur pour l'insérer dans du HTML. */
function e(string $texte): string
{
    return htmlspecialchars($texte, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
