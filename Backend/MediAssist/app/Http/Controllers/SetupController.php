<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class SetupController extends Controller
{
    /** GET /api/setup/status — lets the frontend decide whether to show the first-run wizard. */
    public function status()
    {
        return response()->json(['needsSetup' => User::count() === 0]);
    }

    /**
     * POST /api/setup/create-admin
     * Creates the first admin account. Guarded by User::count() rather than
     * auth, since there is no logged-in user yet on a fresh install — this
     * is the only thing preventing it from being used after setup is done.
     */
    public function createAdmin(Request $request)
    {
        if (User::count() > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Le compte administrateur existe déjà.',
            ], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|unique:users',
            'password' => 'required|string|min:6|confirmed',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => 'admin',
        ]);

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json(['user' => $user, 'token' => $token], 201);
    }
}
