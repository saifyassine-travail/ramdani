<?php

namespace App\Services;

use App\Models\User;
use Exception;
use Google\Client;
use Google\Service\Drive;
use Google\Service\Drive\DriveFile;

class GoogleDriveService
{
    private const FOLDER_NAME = 'MediAssist Backups';

    /**
     * Build an authenticated Google Client for a given user.
     */
    private function buildClient(User $user): Client
    {
        $client = new Client();
        $client->setClientId(config('services.google.client_id'));
        $client->setClientSecret(config('services.google.client_secret'));
        $client->setRedirectUri(config('services.google.redirect'));
        $client->addScope(Drive::DRIVE_FILE);
        $client->setAccessType('offline');

        $token = [
            'access_token'  => $user->google_access_token,
            'refresh_token' => $user->google_refresh_token,
            'expires_in'    => $user->google_token_expires_at
                ? now()->diffInSeconds($user->google_token_expires_at, false)
                : 3600,
        ];

        $client->setAccessToken($token);

        // Auto-refresh expired token
        if ($client->isAccessTokenExpired()) {
            if (!$user->google_refresh_token) {
                throw new Exception('Google token expired and no refresh token available. Please re-link your Google account.');
            }

            $newToken = $client->fetchAccessTokenWithRefreshToken($user->google_refresh_token);

            if (isset($newToken['error'])) {
                throw new Exception('Failed to refresh Google token: ' . $newToken['error_description']);
            }

            // Persist the new tokens
            $user->update([
                'google_access_token'    => $newToken['access_token'],
                'google_token_expires_at' => now()->addSeconds($newToken['expires_in']),
            ]);

            $client->setAccessToken($newToken);
        }

        return $client;
    }

    /**
     * Get or create the MediAssist Backups folder in the user's Drive.
     */
    private function getOrCreateFolder(Drive $driveService): string
    {
        // Search for existing folder
        $results = $driveService->files->listFiles([
            'q'      => "name='" . self::FOLDER_NAME . "' and mimeType='application/vnd.google-apps.folder' and trashed=false",
            'fields' => 'files(id, name)',
        ]);

        if (count($results->getFiles()) > 0) {
            return $results->getFiles()[0]->getId();
        }

        // Create folder
        $folderMeta = new DriveFile([
            'name'     => self::FOLDER_NAME,
            'mimeType' => 'application/vnd.google-apps.folder',
        ]);

        $folder = $driveService->files->create($folderMeta, ['fields' => 'id']);
        return $folder->getId();
    }

    /**
     * Upload an encrypted backup file to the user's Google Drive.
     * Returns the Drive file ID.
     */
    public function uploadFile(User $user, string $localPath, string $fileName): string
    {
        $client  = $this->buildClient($user);
        $service = new Drive($client);

        $folderId = $this->getOrCreateFolder($service);

        $fileMeta = new DriveFile([
            'name'    => $fileName,
            'parents' => [$folderId],
        ]);

        $result = $service->files->create($fileMeta, [
            'data'       => file_get_contents($localPath),
            'mimeType'   => 'application/octet-stream',
            'uploadType' => 'multipart',
            'fields'     => 'id',
        ]);

        return $result->getId();
    }

    /**
     * List all backup files in this user's MediAssist Drive folder.
     */
    public function listBackups(User $user): array
    {
        $client  = $this->buildClient($user);
        $service = new Drive($client);

        $folderId = $this->getOrCreateFolder($service);

        $results = $service->files->listFiles([
            'q'       => "'{$folderId}' in parents and trashed=false",
            'fields'  => 'files(id, name, size, createdTime)',
            'orderBy' => 'createdTime desc',
        ]);

        return array_map(function ($file) {
            return [
                'drive_file_id' => $file->getId(),
                'name'          => $file->getName(),
                'size'          => $file->getSize(),
                'created_at'    => $file->getCreatedTime(),
            ];
        }, $results->getFiles());
    }

    /**
     * Download a backup file from Google Drive to a temp local path.
     * Returns the local temporary file path.
     */
    public function downloadFile(User $user, string $driveFileId): string
    {
        $client  = $this->buildClient($user);
        $service = new Drive($client);

        $response = $service->files->get($driveFileId, ['alt' => 'media']);
        $content  = $response->getBody()->getContents();

        $tempPath = sys_get_temp_dir() . '/mediassist_restore_' . uniqid() . '.enc';
        file_put_contents($tempPath, $content);

        return $tempPath;
    }

    /**
     * Delete a backup file from Drive.
     */
    public function deleteFile(User $user, string $driveFileId): void
    {
        $client  = $this->buildClient($user);
        $service = new Drive($client);
        $service->files->delete($driveFileId);
    }
}
