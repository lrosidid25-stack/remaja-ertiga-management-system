<?php
$users = [
    ["id"=>1,"username"=>"admin","password"=>"admin123"],
    ["id"=>2,"username"=>"ketua","password"=>"ketua123"],
    ["id"=>3,"username"=>"sekretaris","password"=>"sekretaris123"],
    ["id"=>4,"username"=>"bendahara","password"=>"bendahara123"],
    ["id"=>5,"username"=>"humas","password"=>"humas123"],
];
echo "PASTE KE GOOGLE SHEET (kolom C, mulai baris 2):\n\n";
foreach ($users as $u) {
    $hash = password_hash($u["password"], PASSWORD_DEFAULT);
    echo "Baris {$u["id"]}: {$hash}\n";
}