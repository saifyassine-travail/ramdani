<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * A de-identified clinical case report from an external reference corpus
 * (PMC-Patients, E3C Corpus). This is reference/literature data for
 * differential-diagnosis and similar-case lookup — NOT a real patient of
 * the practice. Kept fully separate from App\Models\Patient.
 */
class ResearchCase extends Model
{
    use HasFactory;

    protected $table = 'research_cases';

    protected $fillable = [
        'source',
        'source_id',
        'language',
        'title',
        'age',
        'gender',
        'summary_text',
        'entities',
        'license',
        'source_url',
    ];

    protected $casts = [
        'entities' => 'array',
    ];

    // Internal Postgres generated tsvector column used for full-text search —
    // not meaningful to API consumers.
    protected $hidden = [
        'searchable',
    ];
}
