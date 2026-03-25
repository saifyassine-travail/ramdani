<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\BackupService;
use Illuminate\Console\Command;
use Exception;

class BackupUserData extends Command
{
    /**
     * php artisan backup:user {userId}
     * php artisan backup:user --all
     */
    protected $signature = 'backup:user
                            {userId? : The ID of the specific user to backup}
                            {--all : Backup all users who have linked their Google account}
                            {--password= : Encryption password (for scheduled/automated use only)}';

    protected $description = 'Create an encrypted Google Drive backup of user medical data';

    public function __construct(private readonly BackupService $backupService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        if ($this->option('all')) {
            return $this->backupAllUsers();
        }

        $userId = $this->argument('userId');
        if (!$userId) {
            $this->error('Please provide a userId or use --all flag.');
            return Command::FAILURE;
        }

        return $this->backupSingleUser((int) $userId);
    }

    private function backupAllUsers(): int
    {
        $users = User::whereNotNull('google_access_token')->get();
        $this->info("Found {$users->count()} users with Google accounts linked.");

        $success = 0;
        $failed  = 0;

        foreach ($users as $user) {
            // For automated backups, derive a deterministic password from a server-side secret + user id
            // This is safe because the backup is for disaster-recovery purposes managed by each doctor
            $autoPassword = $this->deriveAutoPassword($user->id);

            try {
                $result = $this->backupService->createBackup($user, $autoPassword);
                $this->info("✅ User #{$user->id} ({$user->email}): backed up → {$result['file_name']}");
                $success++;
            } catch (Exception $e) {
                $this->error("❌ User #{$user->id} ({$user->email}): {$e->getMessage()}");
                $failed++;
            }
        }

        $this->info("Backup complete: {$success} succeeded, {$failed} failed.");
        return $failed > 0 ? Command::FAILURE : Command::SUCCESS;
    }

    private function backupSingleUser(int $userId): int
    {
        $user = User::find($userId);
        if (!$user) {
            $this->error("User #{$userId} not found.");
            return Command::FAILURE;
        }

        if (!$user->google_access_token) {
            $this->error("User #{$userId} has not linked a Google account.");
            return Command::FAILURE;
        }

        $password = $this->option('password') ?? $this->deriveAutoPassword($userId);

        try {
            $result = $this->backupService->createBackup($user, $password);
            $this->info("✅ Backup created: {$result['file_name']} ({$result['size_bytes']} bytes)");
            $this->info("   Drive File ID: {$result['drive_file_id']}");
            return Command::SUCCESS;
        } catch (Exception $e) {
            $this->error("❌ Backup failed: {$e->getMessage()}");
            return Command::FAILURE;
        }
    }

    /**
     * Derive a deterministic password for automated backups.
     * Uses APP_KEY + user ID — same password is always produced for the same user,
     * but it is never exposed outside server context.
     */
    private function deriveAutoPassword(int $userId): string
    {
        $secret = config('app.key') . ':mediassist_auto_backup:' . $userId;
        return hash('sha256', $secret);
    }
}
