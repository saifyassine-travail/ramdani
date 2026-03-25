<?php

namespace App\Services;

use Exception;

class EncryptionService
{
    private const CIPHER = 'AES-256-CBC';
    private const KEY_LENGTH = 32; // 256 bits
    private const IV_LENGTH = 16;  // 128 bits
    private const ITERATIONS = 100000;
    private const SALT_LENGTH = 32;

    /**
     * Encrypt data using AES-256-CBC with PBKDF2 key derivation.
     * Output format: base64( salt + iv + cipher_text )
     */
    public function encrypt(string $data, string $password): string
    {
        $salt = random_bytes(self::SALT_LENGTH);
        $iv   = random_bytes(self::IV_LENGTH);
        $key  = $this->deriveKey($password, $salt);

        $encrypted = openssl_encrypt($data, self::CIPHER, $key, OPENSSL_RAW_DATA, $iv);

        if ($encrypted === false) {
            throw new Exception('Encryption failed: ' . openssl_error_string());
        }

        // Prepend salt + iv for storage — they are NOT secret
        return base64_encode($salt . $iv . $encrypted);
    }

    /**
     * Decrypt data using the same password used during encryption.
     */
    public function decrypt(string $encryptedBase64, string $password): string
    {
        $raw = base64_decode($encryptedBase64, true);

        if ($raw === false || strlen($raw) < self::SALT_LENGTH + self::IV_LENGTH + 1) {
            throw new Exception('Invalid encrypted data format.');
        }

        $salt      = substr($raw, 0, self::SALT_LENGTH);
        $iv        = substr($raw, self::SALT_LENGTH, self::IV_LENGTH);
        $cipherText = substr($raw, self::SALT_LENGTH + self::IV_LENGTH);

        $key = $this->deriveKey($password, $salt);

        $decrypted = openssl_decrypt($cipherText, self::CIPHER, $key, OPENSSL_RAW_DATA, $iv);

        if ($decrypted === false) {
            throw new Exception('Decryption failed — wrong password or corrupted file.');
        }

        return $decrypted;
    }

    /**
     * Derive a 256-bit key from a password + salt using PBKDF2-SHA256.
     */
    private function deriveKey(string $password, string $salt): string
    {
        return hash_pbkdf2('sha256', $password, $salt, self::ITERATIONS, self::KEY_LENGTH, true);
    }
}
