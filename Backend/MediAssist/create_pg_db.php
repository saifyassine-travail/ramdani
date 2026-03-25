<?php
$host = '127.0.0.1';
$port = '5432';
$user = 'postgres';
$passwords = ['root', 'admin', '123456', 'password', 'postgres', 'saif', 'mediassist'];

echo "Testing passwords for user '$user'...\n";

foreach ($passwords as $pass) {
    try {
        echo "Trying password: '$pass' ... ";
        $pdo = new PDO("pgsql:host=$host;port=$port;dbname=postgres", $user, $pass);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        echo "SUCCESS!\n";
        
        // Create database if needed
        $stmt = $pdo->query("SELECT 1 FROM pg_database WHERE datname = 'mediassist'");
        if ($stmt->fetch()) {
            echo "Database 'mediassist' already exists.\n";
        } else {
            echo "Creating database 'mediassist'...\n";
            $pdo->exec("CREATE DATABASE mediassist");
            echo "Database created successfully.\n";
        }
        exit(0); // Success
    } catch (PDOException $e) {
        echo "Failed.\n";
    }
}

echo "All passwords failed.\n";
exit(1);
