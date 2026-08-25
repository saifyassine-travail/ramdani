<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Reference-library table for de-identified clinical case reports (PMC-Patients,
     * E3C Corpus). Fully separate from the app's real `patients` table — never joined
     * to or referenced by Patient/Appointment. See App\Models\ResearchCase.
     */
    public function up(): void
    {
        Schema::create('research_cases', function (Blueprint $table) {
            $table->id();
            $table->string('source')->index();          // pmc_patients | e3c
            $table->string('source_id');                 // patient_uid (PMC) or synthetic id (E3C)
            $table->string('language', 8)->index();      // en | fr | it | es | eu
            $table->text('title')->nullable();
            $table->string('age')->nullable();            // stored as text: PMC ages are messy [[value, unit], ...] tuples
            $table->string('gender')->nullable();
            $table->text('summary_text');                 // main narrative — the searchable case text
            $table->jsonb('entities')->nullable();         // E3C tagged entity spans: [{text, tag}, ...]
            $table->string('license');                     // CC-BY-NC-SA-4.0 | CC-BY-NC-4.0
            $table->string('source_url')->nullable();
            $table->timestamps();

            $table->unique(['source', 'source_id']);
        });

        // Full-text search at 250k+ row scale: a generated tsvector column + GIN index.
        // Using the 'simple' text search config (no language-specific stemming) since
        // this table is multilingual (en/fr/it/es/eu) and a single stemmer would be
        // wrong for most rows.
        DB::statement(<<<SQL
            ALTER TABLE research_cases
            ADD COLUMN searchable tsvector
            GENERATED ALWAYS AS (
                to_tsvector('simple', coalesce(title, '') || ' ' || summary_text)
            ) STORED
        SQL);

        DB::statement('CREATE INDEX research_cases_searchable_gin ON research_cases USING GIN (searchable)');
    }

    public function down(): void
    {
        Schema::dropIfExists('research_cases');
    }
};
