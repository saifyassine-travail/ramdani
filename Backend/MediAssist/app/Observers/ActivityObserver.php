<?php

namespace App\Observers;

use App\Services\ActivityLogger;
use Illuminate\Database\Eloquent\Model;

/**
 * One observer for all audited models. Turns Eloquent create/update/delete events
 * into human-readable French audit entries. Bulk operations that use the query
 * builder (e.g. backup restore) bypass Eloquent events and are intentionally not
 * logged here.
 */
class ActivityObserver
{
    /** Model class short-name => French noun used in the description. */
    private const NOUNS = [
        'Patient'     => 'Patient',
        'Appointment' => 'Rendez-vous',
        'Medicament'  => 'Médicament',
        'Analysis'    => 'Analyse',
        'User'        => 'Utilisateur',
    ];

    public function created(Model $model): void
    {
        $this->record($model, 'created', 'créé');
    }

    public function updated(Model $model): void
    {
        $this->record($model, 'updated', 'modifié');
    }

    public function deleted(Model $model): void
    {
        $this->record($model, 'deleted', 'supprimé');
    }

    private function record(Model $model, string $event, string $verb): void
    {
        $base   = class_basename($model);
        $noun   = self::NOUNS[$base] ?? $base;
        $label  = $this->subjectLabel($model);
        $action = strtolower($base) . '.' . $event;

        $description = trim("{$noun} {$label} {$verb}");

        ActivityLogger::log($action, $description, $model);
    }

    /** A short human identifier for the affected record. */
    private function subjectLabel(Model $model): string
    {
        try {
            $base = class_basename($model);

            return match ($base) {
                'Patient'     => trim(($model->first_name ?? '') . ' ' . ($model->last_name ?? '')) ?: ('#' . $model->getKey()),
                'Medicament'  => $model->name ?? ('#' . $model->getKey()),
                'Analysis'    => $model->type_analyse ?? ('#' . $model->getKey()),
                'User'        => $model->name ?? ('#' . $model->getKey()),
                'Appointment' => '#' . $model->getKey(),
                default       => '#' . $model->getKey(),
            };
        } catch (\Throwable $e) {
            return '#' . $model->getKey();
        }
    }
}
