<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class SettingsController extends Controller
{
    // Get user settings
    public function getUserSettings(Request $request)
    {
        try {
            $userId = auth()->id();
            if (!$userId) {
                return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
            }
            
            $settings = DB::table('user_settings')
                ->where('user_id', $userId)
                ->first();

            // Default settings if none exist
            if (!$settings) {
                $settings = [
                    'appointment_duration' => 30,
                    'working_hours_start' => '08:00',
                    'working_hours_end' => '18:00',
                    'working_days' => json_encode(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
                    'language' => 'fr',
                    'date_format' => 'DD/MM/YYYY',
                    'time_format' => '24h',
                    'email_notifications' => true,
                    'sms_reminders' => true,
                    'custom_measures' => '[]',
                ];
            }

            return response()->json([
                'success' => true,
                'data' => $settings
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    // Update user settings
    public function updateUserSettings(Request $request)
    {
        try {
            $user = auth()->user();
            if (!$user) {
                return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
            }
            $userId = $user->id;

            // Whitelist only known DB columns to avoid unknown field errors
            $allowed = [
                'appointment_duration', 'working_hours_start', 'working_hours_end',
                'working_days', 'max_appointments_per_day', 'allow_same_day_appointments',
                'email_notifications', 'sms_reminders', 'reminder_timing', 'daily_summary_email',
                'language', 'date_format', 'time_format', 'dashboard_layout', 'default_view',
                'practice_name', 'specialization', 'license_number', 'address', 'phone',
                'practice_email', 'session_timeout', 'two_factor_enabled', 'custom_measures'
            ];

            $data = [];
            foreach ($allowed as $field) {
                if ($request->has($field)) {
                    $data[$field] = $request->input($field);
                }
            }
            $data['user_id'] = $userId;

            // Handle arrays to JSON for DB query builder
            if (isset($data['custom_measures']) && is_array($data['custom_measures'])) {
                $data['custom_measures'] = json_encode($data['custom_measures']);
            }
            if (isset($data['working_days']) && is_array($data['working_days'])) {
                $data['working_days'] = json_encode($data['working_days']);
            }
            // Cast booleans to integers for PostgreSQL compatibility
            foreach (['email_notifications', 'sms_reminders', 'allow_same_day_appointments', 'two_factor_enabled', 'daily_summary_email'] as $boolField) {
                if (isset($data[$boolField])) {
                    $data[$boolField] = $data[$boolField] ? true : false;
                }
            }

            \Log::info('Updating User Settings for user ' . $userId, $data);

            DB::table('user_settings')->updateOrInsert(
                ['user_id' => $userId],
                $data
            );

            return response()->json([
                'success' => true,
                'message' => 'Paramètres mis à jour avec succès'
            ]);
        } catch (\Exception $e) {
            \Log::error('Settings update error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    // Get all users (Admin only)
    public function getUsers(Request $request)
    {
        try {
            // TODO: Add admin check
            // if ($request->user()->role !== 'admin') {
            //     return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
            // }

            $users = User::select('id', 'name', 'email', 'role', 'permissions', 'created_at')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $users
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    // Create new user (Admin only)
    public function createUser(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'name' => 'required|string|max:255',
                'email' => 'required|string|email|max:255|unique:users',
                'password' => 'required|string|min:6',
                'role' => 'required|in:admin,doctor,nurse,receptionist'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'role' => $request->role,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Utilisateur créé avec succès',
                'data' => $user
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    // Update user (Admin only)
    public function updateUser(Request $request, $id)
    {
        try {
            $user = User::findOrFail($id);

            $validator = Validator::make($request->all(), [
                'name' => 'sometimes|string|max:255',
                'email' => 'sometimes|string|email|max:255|unique:users,email,' . $id,
                'role' => 'sometimes|in:admin,doctor,nurse,receptionist',
                'password' => 'sometimes|string|min:6'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            if ($request->has('name')) $user->name = $request->name;
            if ($request->has('email')) $user->email = $request->email;
            if ($request->has('role')) $user->role = $request->role;
            if ($request->has('password')) $user->password = Hash::make($request->password);

            $user->save();

            return response()->json([
                'success' => true,
                'message' => 'Utilisateur mis à jour avec succès',
                'data' => $user
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    // Delete user (Admin only)
    public function deleteUser($id)
    {
        try {
            $user = User::findOrFail($id);
            $user->delete();

            return response()->json([
                'success' => true,
                'message' => 'Utilisateur supprimé avec succès'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    // Update user permissions (Admin only)
    public function updateUserPermissions(Request $request, $id)
    {
        try {
            $user = User::findOrFail($id);

            $validator = Validator::make($request->all(), [
                'permissions' => 'required|array',
                'permissions.*' => 'string'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors()
                ], 422);
            }

            $user->permissions = json_encode($request->permissions);
            $user->save();

            return response()->json([
                'success' => true,
                'message' => 'Permissions mises à jour avec succès',
                'data' => $user
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
