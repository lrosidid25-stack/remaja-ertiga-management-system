<?php
/**
 * GOOGLE CONFIG — Spreadsheet & Drive IDs
 */
define('GOOGLE_SPREADSHEET_ID', '1HOq4XrX4v5u8f77ao2aEDakqPQL_sxK2qSrZIaJ_0qQ');
define('GOOGLE_SERVICE_ACCOUNT_FILE', (getenv('VERCEL')||getenv('VERCEL_ENV')) ? '/tmp/service-account.json' : __DIR__ . '/service-account.json');

// Google Drive folder IDs
define('GDRIVE_BUKTI_FOLDER', '1GGvwg5HcWUQtUMXTABz3jeEp_nIQlkhm');
define('GDRIVE_FOTO_FOLDER',  '1Dmc3JjkeSAh9mmBUnBGzA2-J8peX3Utk');
define('GDRIVE_NOTA_FOLDER',  '1sRqsyr1KYcIAT9WWjOLdHYWc7IkbGi1p');
define('GDRIVE_LOGO_FOLDER',  '1kmcFBxCXbjlUKskjRKntj_viDP86HSgs');
