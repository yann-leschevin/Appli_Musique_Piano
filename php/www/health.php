<?php
// Contrôle de santé : renvoie un JSON indiquant que le service est actif.
require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
echo json_encode(
    ['status' => 'ok', 'service' => APP_NAME, 'message' => 'Le service fonctionne correctement.'],
    JSON_UNESCAPED_UNICODE
);
